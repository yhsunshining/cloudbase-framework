import assert from 'assert'
import { getDatapatch } from './data-patch.js'

const cases = [
    {
        desc: 'New component',
        base: {},
        data: { id1: { a: 1 } },
        patch: { id1: { a: 1 } }
    }, {
        desc: 'Component prop update',
        base: { id1: { a: 1, b: 2 } },
        data: { id1: { a: 1, b: 3 } },
        patch: { 'id1.b': 3 }
    }, {
        desc: 'More than 1/3 of props changed',
        base: { id1: { a: 1, b: 2, c: 3 } },
        data: { id1: { a: 1, b: 4, c: 5 } },
        patch: { id1: { a: 1, b: 4, c: 5 } }
    }, {
        desc: 'New multiple components',
        base: {},
        data: { id1: { a: 1 }, id2: { c: 2 }, id3: [{ c: 1 }] },
        patch: { id1: { a: 1 }, id2: { c: 2 }, id3: [{ c: 1 }] }
    },
    {
        desc: 'Update component prop in array',
        base: { id1: [{ a: 1 }, { a: 2 }, { a: 8 }] },
        data: { id1: [{ a: 1 }, { a: 3 }, { a: 8 }] },
        patch: { 'id1[1].a': 3 }
    },
    {
        desc: 'Update component prop in 2d array',
        base: { id1: [[{ a: 1 }, { a: 2 }], [{ a: 1 }]] },
        data: { id1: [[{ a: 1 }, { a: 3 }], [{ a: 1 }]] },
        patch: { 'id1[0][1].a': 3 }
    },
    {
        desc: 'Add component in array',
        base: { id1: [{ a: 1 }, { a: 2 }] },
        data: { id1: [{ a: 1 }, { a: 2 }, { a: 9 }] },
        patch: { 'id1[2]': { a: 9 } }
    },
    {
        desc: 'Add 2 components in array',
        base: { id1: [{ a: 1 }, { a: 2 }] },
        data: { id1: [{ a: 1 }, { a: 2 }, { a: 9 }, { a: 8 }] },
        patch: { 'id1[2]': { a: 9 }, 'id1[3]': { a: 8 } }
    },
    {
        desc: 'array: delete component',
        base: { id1: [{ a: 1 }, { a: 2 }, { a: 2 }] },
        data: { id1: [{ a: 1 }, { a: 2 }] },
        patch: { id1: [{ a: 1 }, { a: 2 }] }
    }
]

for (const c of cases) {
    assert.deepStrictEqual(getDatapatch(c.base, c.data), c.patch, c.desc)
}
