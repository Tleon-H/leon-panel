import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { createDesktopWidget, defaultStudioConfig } from '../studio/studioConfig.ts'
import {
  buildDesktopLayoutSavePayload,
  createDesktopLayoutSnapshot,
  diffDesktopLayoutChanges,
  moveArrayItem,
  syncGroupOwnership,
} from './desktopEdit.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')

test('desktop layout snapshot and diff detect group reorders, renames, style changes, deletes, cross-group moves, and widget changes', () => {
  const initialGroups = [
    {
      id: 1,
      title: 'HomeLab',
      iconStyle: 0 as number | null,
      items: [
        { id: 101, itemIconGroupId: 1, title: 'Docker', url: 'https://docker.local', sort: 1 },
        { id: 102, itemIconGroupId: 1, title: 'Proxmox', url: 'https://pve.local', sort: 2 },
      ],
    },
    {
      id: 2,
      title: 'Media',
      iconStyle: 1 as number | null,
      items: [
        { id: 201, itemIconGroupId: 2, title: 'Jellyfin', url: 'https://jellyfin.local', sort: 1 },
      ],
    },
    {
      id: 3,
      title: 'Temp',
      iconStyle: null as number | null,
      items: [
        { id: 301, itemIconGroupId: 3, title: 'Scratch', url: 'https://scratch.local', sort: 1 },
      ],
    },
  ]
  const w1 = createDesktopWidget('clock', 1)
  const w2 = createDesktopWidget('todo', 2)
  const snapshot = createDesktopLayoutSnapshot(initialGroups, [w1, w2])

  // No changes right after snapshot
  const emptyDiff = diffDesktopLayoutChanges(snapshot, initialGroups, [w1, w2])
  assert.equal(emptyDiff.hasChanges, false)
  assert.equal(emptyDiff.changeCount, 0)
  assert.deepEqual(emptyDiff.deletedGroupIds, [])
  assert.deepEqual(emptyDiff.deletedItemIds, [])

  // Draft mutations: rename & change style on group 2, move Proxmox (102) into group 2,
  // delete group 3 (and its item 301), delete item 101, create temp draft group (-1) with draft item (-2),
  // and reorder widgets + change colSpan.
  const nextGroups = [
    {
      id: 2,
      title: 'Media Hub',
      iconStyle: 0 as number | null,
      items: [
        { id: 102, itemIconGroupId: 1, title: 'Proxmox', url: 'https://pve.local', sort: 2 },
        { id: 201, itemIconGroupId: 2, title: 'Jellyfin', url: 'https://jellyfin.local', sort: 1 },
      ],
    },
    {
      id: 1,
      title: 'HomeLab',
      iconStyle: 0 as number | null,
      items: [],
    },
    {
      id: -1,
      title: 'AI Lab',
      iconStyle: null as number | null,
      items: [
        { id: -2, itemIconGroupId: -1, title: 'OpenWebUI', url: 'https://ai.local', sort: 1 },
      ],
    },
  ]
  syncGroupOwnership(nextGroups)
  assert.equal(nextGroups[0].items[0].itemIconGroupId, 2)

  const studioCfg = {
    ...defaultStudioConfig(),
    widgets: [{ ...w2, colSpan: 2 as const }, { ...w1 }],
  }
  const diff = diffDesktopLayoutChanges(snapshot, nextGroups, studioCfg.widgets)

  assert.equal(diff.hasChanges, true)
  assert.equal(diff.groupsReordered, true)
  assert.equal(diff.groupMetaChanged, true)
  assert.deepEqual(diff.deletedGroupIds, [3])
  assert.deepEqual(diff.deletedItemIds, [101, 301])
  assert.equal(diff.movedItems.length, 1)
  assert.equal(diff.movedItems[0].fromGroupId, 1)
  assert.equal(diff.movedItems[0].toGroupId, 2)
  assert.equal(diff.widgetsChanged, true)

  const payload = buildDesktopLayoutSavePayload(snapshot, nextGroups, studioCfg)
  assert.equal(payload.groups.length, 3)
  assert.equal(payload.groups[0].id, 2)
  assert.equal(payload.groups[0].title, 'Media Hub')
  assert.equal(payload.groups[0].iconStyle, 0)
  assert.deepEqual(payload.groups[0].items.map(i => i.id), [102, 201])
  // Temp negative IDs are converted to 0 for backend atomic creation
  assert.equal(payload.groups[2].id, 0)
  assert.equal(payload.groups[2].items[0].id, 0)
  assert.deepEqual(payload.deletedGroupIds, [3])
  assert.deepEqual(payload.deletedItemIds, [101, 301])
  assert.ok(payload.studioConfig !== null)

  // When widgets did not change, studioConfig is omitted (null)
  const payloadNoWidgets = buildDesktopLayoutSavePayload(snapshot, nextGroups, {
    ...defaultStudioConfig(),
    widgets: [w1, w2],
  })
  assert.equal(payloadNoWidgets.studioConfig, null)

  // Original snapshot remains completely unmutated for cancel rollback
  assert.equal(snapshot.groups.length, 3)
  assert.equal(snapshot.groups[0].id, 1)
  assert.equal(snapshot.groups[0].items?.length, 2)
  assert.equal(snapshot.groups[1].title, 'Media')
  assert.equal(snapshot.groups[1].iconStyle, 1)
})

test('moveArrayItem moves elements safely and ignores out-of-range deltas', () => {
  assert.deepEqual(moveArrayItem(['a', 'b', 'c'], 0, 1), ['b', 'a', 'c'])
  assert.deepEqual(moveArrayItem(['a', 'b', 'c'], 2, -1), ['a', 'c', 'b'])
  assert.deepEqual(moveArrayItem(['a', 'b', 'c'], 0, -1), ['a', 'b', 'c'])
  assert.deepEqual(moveArrayItem(['a', 'b', 'c'], 2, 1), ['a', 'b', 'c'])
})

test('Desktop Edit Mode stays strictly in draft before Save and commits via single atomic saveDesktopLayout API', () => {
  const home = readFileSync(join(root, 'src/views/home/index.vue'), 'utf8')
  const editItem = readFileSync(join(root, 'src/views/home/components/EditItem/index.vue'), 'utf8')

  assert.match(home, /data-testid="desktop-edit-bar"/)
  assert.match(home, /data-testid="home-toggle-edit-mode"/)
  assert.match(home, /:edit-mode="desktopEditMode"/)
  assert.match(home, /:draft-mode="desktopEditMode"/)
  assert.match(home, /handleCardLongPressStart/)
  assert.match(home, /saveDesktopLayout\(payload\)/)
  // Edit mode must NOT prematurely call editGroup / deleteGroups / saveGroupSort
  assert.doesNotMatch(home, /\beditGroup\b/)
  assert.doesNotMatch(home, /\bdeleteGroups\b/)
  assert.doesNotMatch(home, /\bsaveGroupSort\b/)
  // EditItem supports draftMode without calling backend edit()
  assert.match(editItem, /if \(props\.draftMode\)/)

  const zh = JSON.parse(readFileSync(join(root, 'src/locales/zh-CN.json'), 'utf8'))
  const en = JSON.parse(readFileSync(join(root, 'src/locales/en-US.json'), 'utf8'))
  assert.deepEqual(Object.keys(zh.panelHome).sort(), Object.keys(en.panelHome).sort())
})
