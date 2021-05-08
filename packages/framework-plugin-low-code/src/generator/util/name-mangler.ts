/**
 * Generate names: a, b, c,... aa, ab, ac.. ba, bb, bc...
 */
export default class NameMangler {
  current?: string[];
  mangled: { [name: string]: string } = {};

  private leadingChars: string[];
  private candidateChars: string[];
  private blackList: string[];

  constructor(
    opts: {
      leadingCharRanges?: string[];
      candidateCharRanges?: string[];
      blackList?: string[];
    } = {}
  ) {
    const leadingCharRanges = opts.leadingCharRanges || ['a', 'z', 'A', 'Z'];
    const candidateCharRanges = opts.candidateCharRanges || [
      'a',
      'z',
      'A',
      'Z',
      '0',
      '9',
    ];
    this.leadingChars = createCharsFromRanges(leadingCharRanges);
    this.candidateChars = createCharsFromRanges(candidateCharRanges);
    this.blackList = opts.blackList || [];
  }

  private next() {
    if (!this.current) {
      this.current = [this.leadingChars[0]];
      return this.current.join('');
    }
    const len = this.current.length;
    // from right -> left
    for (let i = len - 1; i >= 0; i--) {
      const chars = i === 0 ? this.leadingChars : this.candidateChars;
      const curCharIdx = chars.indexOf(this.current[i]);
      if (curCharIdx < chars.length - 1) {
        // not exceeding limit of current line
        this.current[i] = chars[curCharIdx + 1];
        break;
      } else if (i === 0) {
        // no more lines
        this.current[i] = chars[0];
        this.current.push(chars[0]);
      } else {
        this.current[i] = chars[0];
      }
    }
    return this.current.join('');
  }

  mangle(name: string): string {
    let mangled = this.mangled[name];
    if (!mangled) {
      mangled = this.next();
      if (this.blackList.indexOf(mangled) > -1) {
        return this.mangle(name);
      }
      this.mangled[name] = mangled;
    }
    return mangled;
  }
}

function createCharsFromRanges(range: string[]) {
  const chars: string[] = [];
  for (let i = 0; i + 1 < range.length; i += 2) {
    for (
      let code = range[i].charCodeAt(0);
      code <= range[i + 1].charCodeAt(0);
      code++
    ) {
      chars.push(String.fromCharCode(code));
    }
  }
  return chars;
}

/* const mangler = new NameMangler()
for (let i = 0; i < 900; i++) {
  console.log('>>', i, mangler.next())
} */
