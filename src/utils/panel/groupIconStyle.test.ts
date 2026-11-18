import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { filterIconGroups } from '../search/filterIcons.ts'
import {
  groupIconStyleControlValue,
  groupIconStyleFollow,
  groupIconStyleIcon,
  groupIconStyleInfo,
  groupIconStyleSelectOptions,
  normalizeGroupIconStyle,
  resolveGroupIconStyle,
} from './groupIconStyle.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')

function source(path: string): string {
  return readFileSync(join(root, path), 'utf8')
}

test('a group style overrides the global style, and an empty group follows it', () => {
  assert.equal(resolveGroupIconStyle(groupIconStyleInfo, groupIconStyleIcon), groupIconStyleInfo)
  assert.equal(resolveGroupIconStyle(groupIconStyleIcon, groupIconStyleInfo), groupIconStyleIcon)
  assert.equal(resolveGroupIconStyle(null, groupIconStyleInfo), groupIconStyleInfo)
  assert.equal(resolveGroupIconStyle(undefined, groupIconStyleIcon), groupIconStyleIcon)
  assert.equal(resolveGroupIconStyle(undefined, undefined), groupIconStyleIcon)
  assert.equal(resolveGroupIconStyle(2, groupIconStyleInfo), groupIconStyleInfo)
  assert.equal(resolveGroupIconStyle(groupIconStyleFollow, groupIconStyleIcon), groupIconStyleIcon)
  assert.equal(groupIconStyleInfo, 0)
  assert.equal(groupIconStyleIcon, 1)
})

test('the group editor offers follow global and the two existing icon styles', () => {
  const options = groupIconStyleSelectOptions(key => key)
  assert.deepEqual(options.map(item => item.value), [groupIconStyleFollow, groupIconStyleInfo, groupIconStyleIcon])
  assert.deepEqual(options.map(item => item.label), [
    'apps.itemGroupManage.followGlobal',
    'apps.baseSettings.detailIcon',
    'apps.baseSettings.smallIcon',
  ])
  assert.equal(new Set(options.map(item => item.value)).size, 3)
  assert.equal(groupIconStyleControlValue(null), groupIconStyleFollow)
  assert.equal(groupIconStyleControlValue(undefined), groupIconStyleFollow)
  assert.equal(groupIconStyleControlValue(0), groupIconStyleInfo)
  assert.equal(groupIconStyleControlValue(1), groupIconStyleIcon)
  assert.equal(normalizeGroupIconStyle(groupIconStyleFollow), null)
  assert.equal(normalizeGroupIconStyle(0), 0)
  assert.equal(normalizeGroupIconStyle('1'), 1)
})

test('search keeps a stored zero style instead of treating it as unset', () => {
  const result = filterIconGroups([
    { title: 'HOME', iconStyle: 0, items: [{ title: '路由', url: '', description: '' }] },
    { title: '常用网站', iconStyle: null, items: [{ title: '路由', url: '', description: '' }] },
  ], '路由', true)
  assert.equal(result.groups.length, 2)
  assert.equal(result.groups[0].iconStyle, 0)
  assert.equal(result.groups[1].iconStyle, null)
  assert.equal(resolveGroupIconStyle(result.groups[0].iconStyle, 1), 0)
  assert.equal(resolveGroupIconStyle(result.groups[1].iconStyle, 1), 1)
})

test('logged-in and guest homepages share one includeItems request', () => {
  const home = source('src/views/home/index.vue')
  const api = source('src/api/panel/itemIconGroup.ts')
  const router = source('src/router/index.ts')
  const getList = home.slice(home.indexOf('function getList()'), home.indexOf('function updateItemIconGroupByNet'))
  const mounted = home.slice(home.indexOf('onMounted(() => {'), home.indexOf('const activeSearchItem'))
  assert.equal(router.match(/component: \(\) => import\('@\/views\/home\/index\.vue'\)/g)?.length, 1)
  assert.match(getList, /getGroupList<Common\.ListResponse<ItemGroup\[\]>>\(true,/)
  assert.equal(getList.match(/getGroupList/g)?.length, 1)
  assert.doesNotMatch(getList, /getListByGroupId/)
  assert.equal(mounted.match(/getList\(\)/g)?.length, 1)
  assert.equal(home.match(/getListByGroupId/g)?.length, 2)
  assert.match(home, /watch\(settingModalShow, \(visible\) => \{\s*if \(visible \|\| items\.value\.some\(group => group\.sortStatus\)\)/)
  assert.match(api, /export function getList<T>\(includeItems = false, sessionCurrent\?: \(\) => boolean\)/)
  assert.match(api, /data: \{ includeItems \}/)
  assert.match(home, /resolveGroupIconStyle\(group\.iconStyle, panelState\.panelConfig\.iconStyle\)/)
  assert.match(home, /handleSaveSort\(itemGroup\)/)
})

test('the home page renders each group with the existing card layouts', () => {
  const home = source('src/views/home/index.vue')
  const enums = source('src/enums/panel/index.ts')
  assert.match(enums, /'info' = 0/)
  assert.match(enums, /'icon' = 1/)
  assert.match(enums, /'small' = 1/)
  assert.match(home, /resolveGroupIconStyle\(/)
  assert.match(home, /groupIconStyle\(itemGroup\) === PanelPanelConfigStyleEnum\.info/)
  assert.match(home, /groupIconStyle\(itemGroup\) === PanelPanelConfigStyleEnum\.icon/)
  assert.match(home, /class="icon-info-box"/)
  assert.match(home, /class="icon-small-box"/)
  assert.match(home, /VueDraggable/)
  assert.match(home, /:disabled="!itemGroup\.sortStatus"/)
  assert.match(home, /@media \(max-width: 500px\)/)
  assert.match(home, /minmax\(200px, 1fr\)/)
  assert.match(home, /minmax\(75px, 1fr\)/)
  assert.match(home, /minmax\(150px, 1fr\)/)
  assert.doesNotMatch(home, /icon-large-box|card-style-custom/)

  const manage = source('src/components/apps/ItemGroupManage/index.vue')
  const style = source('src/utils/panel/groupIconStyle.ts')
  assert.match(manage, /groupIconStyleSelectOptions\(/)
  assert.match(manage, /normalizeGroupIconStyle\(/)
  assert.match(manage, /NSelect/)
  assert.match(manage, /apps\.itemGroupManage\.cardStyle/)
  assert.match(style, /apps\.itemGroupManage\.followGlobal/)
  assert.match(style, /apps\.baseSettings\.detailIcon/)
  assert.match(style, /apps\.baseSettings\.smallIcon/)
  assert.match(source('src/locales/zh-CN.json'), /"followGlobal": "跟随全局"/)
  assert.match(source('src/locales/zh-CN.json'), /"detailIcon": "详情图标"/)
  assert.match(source('src/locales/zh-CN.json'), /"smallIcon": "小图标"/)
  assert.match(home, /watch\(settingModalShow/)

  const globalStyle = source('src/components/apps/Style/index.vue')
  assert.match(globalStyle, /panelState\.panelConfig\.iconStyle/)
  assert.match(globalStyle, /PanelPanelConfigStyleEnum\.info/)
  assert.match(globalStyle, /PanelPanelConfigStyleEnum\.icon/)
})
