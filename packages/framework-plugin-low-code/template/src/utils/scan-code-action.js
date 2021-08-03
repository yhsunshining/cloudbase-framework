import React from "react";
import { Suspense } from "react";
import ReactDOM from 'react-dom';

const ScanCode = React.lazy(() => import('./ScanCodeComponent'));
const WEAPP_SCAN_CODE_ELEMENT_ID = 'weapp-scan-code-modal-root';
export function scanCodeApi(opts) {
  const options = {
    onlyFromCamera: false,
    scanType: ['barCode', 'qrCode'],
    success: () => {},
    fail: () => {},
    complete: () => {},
    ...opts,
  };
  if (typeof options.scanType === 'string') {
    options.scanType = [options.scanType];
  }
  let root = document.getElementById(WEAPP_SCAN_CODE_ELEMENT_ID);
  if (!root) {
    root = document.createElement('div');
    root.id = WEAPP_SCAN_CODE_ELEMENT_ID;
  }
  document.body.appendChild(root);
  ReactDOM.render(<Suspense fallback={<></>}><ScanCode root={root} options={options} /></Suspense>, root);
}
