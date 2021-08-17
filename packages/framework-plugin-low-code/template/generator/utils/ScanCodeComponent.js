import React, { useMemo, useRef, useEffect, useImperativeHandle, useState, useCallback } from 'react';
import ReactDOM from 'react-dom';

import { BrowserMultiFormatReader, NotFoundException, BarcodeFormat, DecodeHintType } from '@zxing/library';
import { app } from '../app/global-api';


export const FORMAT = {
  0: { scanType: 'AZTEC', wxtype: null },
  1: { scanType: 'CODABAR', wxtype: 'barCode' },
  2: { scanType: 'CODE_39', wxtype: 'barCode' },
  3: { scanType: 'CODE_93', wxtype: 'barCode' },
  4: { scanType: 'CODE_128', wxtype: 'barCode' },
  5: { scanType: 'DATA_MATRIX', wxtype: 'qrCode' },
  6: { scanType: 'EAN_8', wxtype: 'barCode' },
  7: { scanType: 'EAN_13', wxtype: 'barCode' },
  8: { scanType: 'ITF', wxtype: 'barCode' },
  9: { scanType: 'MAXICODE', wxtype: null },
  10: { scanType: 'PDF_417', wxtype: 'qrCode' },
  11: { scanType: 'QR_CODE', wxtype: 'qrCode' },
  12: { scanType: 'RSS_14', wxtype: 'barCode' },
  13: { scanType: 'RSS_EXPANDED', wxtype: 'barCode' },
  14: { scanType: 'UPC_A', wxtype: 'barCode' },
  15: { scanType: 'UPC_E', wxtype: 'barCode' },
  16: { scanType: 'UPC_EAN_EXTENSION', wxtype: 'barCode' },
};

const hints = new Map();
const formats = [
  BarcodeFormat.QR_CODE,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.EAN_8,
  BarcodeFormat.EAN_13,
  BarcodeFormat.CODE_39,
  BarcodeFormat.CODE_93,
  BarcodeFormat.CODE_128,
  BarcodeFormat.DATA_MATRIX,
  BarcodeFormat.PDF_417,
];
hints.set(DecodeHintType.POSSIBLE_FORMATS, formats);

const Codescanner = React.forwardRef(({ events = {}, closeScanCode, scanType, onInit }, fref) => {
  const ref = useRef();
  const {
    fail = () => {},
    success = () => {},
    complete = () => {},
  } = events;

  const inited = useRef(false);
  const codeReader = new BrowserMultiFormatReader(hints);
  const start = async () => {
    setTimeout(() => {
      // try harder after 5 sceonds
      hints.set(DecodeHintType.TRY_HARDER, true);
      codeReader.timeBetweenDecodingAttempts = 1500;
      codeReader.hints = hints;
    }, 5000);
    const devices = await codeReader.listVideoInputDevices();

    if (devices.length) {
      try {
        await codeReader.decodeFromConstraints(
          { video: { facingMode: 'environment' } },
          ref.current,
          (result, err) => {
            if (!inited.current) {
              inited.current = true;
              onInit();
            }
            if (result) {
              if (scanType.includes(FORMAT[result.format].wxtype)) {
                success(wechatLikeResult(result));
                complete();
                closeScanCode();
              }
            }
  
            if (err && !err instanceof NotFoundException) {
              fail(err);
              complete();
            }
          },
        );
      } catch (err) {
        fail(err);
        complete();
      }
    } else {
      fail(new Error('No camera detect'));
      complete();
    }
  };

  const stop = () => {
    codeReader.reset();
  };

  useImperativeHandle(fref, () => ({
    start,
    stop,
  }));

  useEffect(() => {
    start().catch(fail);
    return () => {
      stop();
    };
  }, []);
  return (
      <>
        <video
          autoPlay
          ref={ref}
          id="weapp-scancode-video"
        ></video>
      </>
  );
});


function fileToImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async (ev) => {
      const img = new Image();
      img.src = ev.target.result;
      resolve(img);
    };
    reader.onerror = reject;
  });
}

const SCAN_CODE_STATE = 'scan-code-modal';
export default function ScanCode({ root, options }) {
  const {
    onlyFromCamera,
    scanType,
    success: successCallback,
    fail,
    complete,
    enableDefaultBehavior,
  } = options;
  useEffect(() => {
    // 覆盖一次返回按键为关闭
    if (history.state?.SCANCODE !== SCAN_CODE_STATE) {
      history.pushState({ SCANCODE: SCAN_CODE_STATE }, null);
    }
    const onPopState = () => {
      closeScanCode();
    };
    window.addEventListener('popstate', onPopState);
    return () => {
      if (history.state?.SCANCODE === SCAN_CODE_STATE) {
        history.back();
      }
      window.removeEventListener('popstate', onPopState);
    };
  }, [closeScanCode]);
  const ref = useRef();
  const closeScanCode = () => {
    ref.current?.stop?.();
    ReactDOM.render(null, root);
  };
  const success = useCallback((res) => {
    const {result} = res;
    if (enableDefaultBehavior) {
      if (/^https?:\/\//.test(result)) {
        window.open(result);
      } else {
        app.showModal({
          title: '扫描到以下内容',
          content: result,
          showCancel: false,
          confirmColor: '#006eff',
        });
      }
    }
    successCallback(res);
  });
  const [isCameraInit, setIscameraInit] = useState(false);
  const onInitCamera = () => {
    setIscameraInit(true);
  };
  const [modalErrMessage, setModalErrMessage] = useState('');
  const handleModalClick = () => {
    setModalErrMessage('');
  };
  const fileChanged = async (ev) => {
    const { files } = ev.target;
    if (files.length <= 0) return;
    const file = files[0];
    const img = await fileToImage(file);
    hints.set(DecodeHintType.TRY_HARDER, true);
    const codeReader = new BrowserMultiFormatReader(hints);
    try {
      const result = await codeReader.decodeFromImage(img);
      success(wechatLikeResult(result));
      closeScanCode();
    } catch (err) {
      onScanFail(err);
    }
  };
  const scanTypeText = useMemo(() => scanType.map((type) => {
    switch (type) {
      case 'qrCode':
        return '二维码';
      case 'barCode':
        return '条码';
      default:
        return type;
    }
  }).join(' / '), [scanType]);
  const onScanFail = (err) => {
    if (err instanceof NotFoundException) {
      setModalErrMessage(`未发现${scanTypeText}`);
      setIscameraInit(false);
    } else if (err.message === 'Permission denied') {
      setModalErrMessage('请打开相机权限以获取扫码功能');
    } else if (err.message === 'No camera detect') {
      setModalErrMessage('未能检测到相机设备');
    } else {
      setModalErrMessage(err.message);
    }
    setIscameraInit(false);
    fail(err);
  };
  if (modalErrMessage) {
    return <div className="weapp-scancode-modal" onClick={handleModalClick}>
      <div className="weapp-scancode-modal-main">
        <div className="weapp-scancode-scan-wrapper">
          <p className="weapp-scancode-scan-not-found">{modalErrMessage}</p>
          <p>点击重新扫码</p>
        </div>
        <CloseButton onClick={closeScanCode} />
      </div>
    </div>;
  }
  return (
    <div className="weapp-scancode-modal">
      <div className="weapp-scancode-modal-main">
        <Codescanner
          events={{ fail: onScanFail, success, complete }}
          ref={ref}
          closeScanCode={closeScanCode}
          scanType={scanType}
          onInit={(onInitCamera)}
        />

        {isCameraInit && <><CloseButton onClick={closeScanCode} />
        <div className="weapp-scancode-scan-wrapper">
          <div className="weapp-scancode-scan-square">
            <div className="weapp-scancode-scan-bar"></div>
          </div>
          <p className="weapp-scancode-scan-tip">扫${scanTypeText}</p>
        </div>
        </>
        }
        {!onlyFromCamera && isCameraInit && <div
          className="weapp-scancode-img-selector"
        >
          <input onChange={fileChanged} type="file" id="weapp-scancode-img-picker-input" accept="image/*" style={{ display: 'none' }} />
          <label
            htmlFor="weapp-scancode-img-picker-input"
            className="weapp-scancode-img-picker"
          >
            <span>
            <svg width="24px" height="24px" viewBox="0 0 24 24" version="1.1" xmlns="http://www.w3.org/2000/svg">
                <title>icon/album</title>
                <g id="icon/album" stroke="none" strokeWidth="1" fill="none" fillRule="evenodd">
                    <rect id="矩形" x="0" y="0" width="24" height="24"></rect>
                    <path d="M21,4 C21.5522847,4 22,4.44771525 22,5 L22,19 C22,19.5522847 21.5522847,20 21,20 L3,20 C2.44771525,20 2,19.5522847 2,19 L2,5 C2,4.44771525 2.44771525,4 3,4 L21,4 Z M20.5,5.5 L3.5,5.5 L3.5,13.932 L8.34720227,9.89314397 C8.69729746,9.60139798 9.19512095,9.58601647 9.56028418,9.84165631 L9.65637439,9.91809179 L14.036,13.86 L16.8907001,11.8207928 C17.2650251,11.5533999 17.7734822,11.5758744 18.1227552,11.8752513 L18.1227552,11.8752513 L20.5,13.913 L20.5,5.5 Z" id="形状结合" fill="#FFFFFF" fillRule="nonzero"></path>
                </g>
            </svg>
            </span>
          </label>
        </div>}
      </div>
    </div>
  );
}

function CloseButton({ onClick }) {
  return (
    <a
          className="weapp-scancode-close-button"
          aria-label="close modal"
          onClick={onClick}
        >
          <svg   width="12px"   height="12px"  viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path fillRule="evenodd" clipRule="evenodd" d="M12.5348 2.04999L7.9998 6.58499L3.4638 2.04999L2.0498 3.46499L6.5858 8.00099L2.0498 12.536L3.4638 13.95L7.9998 9.41499L12.5348 13.95L13.9498 12.536L9.4138 8.00099L13.9498 3.46499L12.5348 2.04999Z" fill="currentColor"/>
          </svg>
        </a>
  );
}

function wechatLikeResult(zxingResult) {
  const wechatResult = {
    result: zxingResult.text || zxingResult.result,
    scanType: FORMAT[zxingResult.format].wxtype,
  };
  return wechatResult;
}

// https://github.com/AlloyTeam/AlloyImage/blob/master/src/module/filter/toGray.js
function toGray(imgData) {
  const { data } = imgData;

  for (let i = 0, n = data.length;i < n;i += 4) {
    const gray = parseInt((0.299 * data[i] + 0.578 * data[i + 1] + 0.114 * data[i + 2]), 10);
    // eslint-disable-next-line no-multi-assign
    data[i + 2] = data[i + 1] = data[i] = gray;
  }

  imgData.data.set(data);

  return imgData;
}

// https://github.com/AlloyTeam/AlloyImage/blob/master/src/module/filter/sharp.js
function sharp(imgData, arg = []) {
  const lamta = arg[0] || 0.6;
  const { data } = imgData;
  const { width } = imgData;

  for (let i = 0, n = data.length;i < n;i += 4) {
    const ii = i / 4;
    const row = parseInt(ii / width, 10);
    const col = ii % width;
    if (row === 0 || col === 0) continue;

    const A = ((row - 1) *  width + (col - 1)) * 4;
    const B = ((row - 1) * width + col) * 4;
    const E = (ii - 1) * 4;

    for (let j = 0;j < 3;j ++) {
      const delta = data[i + j] - (data[B + j] + data[E + j] + data[A + j]) / 3;
      data[i + j] += delta * lamta;
    }
  }

  return imgData;
}
