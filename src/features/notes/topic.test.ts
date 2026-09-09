import { describe, expect, it } from 'vitest'
import { ancestorKeys, cleanTopic, topicKey, topicLeaf, topicSegments } from './topic'

describe('topicKey', () => {
  it('normalises spelling so notes meet on one hub', () => {
    expect(topicKey('Design System')).toBe('design-system')
    expect(topicKey('design   system')).toBe('design-system')
    expect(topicKey('  DESIGN system ')).toBe('design-system')
  })

  it('strips accents', () => {
    expect(topicKey('Diseño')).toBe(topicKey('Diseno'))
  })

  it('keeps path structure', () => {
    expect(topicKey('Product/Onboarding')).toBe('product/onboarding')
    expect(topicKey('Product / Onboarding / Emails')).toBe('product/onboarding/emails')
  })

  it('drops empty segments', () => {
    expect(topicKey('//Product//Onboarding//')).toBe('product/onboarding')
  })

  it('returns an empty key for an empty topic', () => {
    expect(topicKey('   ')).toBe('')
    expect(topicKey('!!!')).toBe('')
  })
})

describe('cleanTopic', () => {
  it('collapses whitespace but keeps casing', () => {
    expect(cleanTopic('  Design   System ')).toBe('Design System')
    expect(cleanTopic('Product /  Onboarding')).toBe('Product/Onboarding')
  })
})

describe('ancestorKeys', () => {
  it('lists every parent hub, outermost first', () => {
    expect(ancestorKeys('a/b/c')).toEqual(['a', 'a/b'])
  })

  it('is empty for a root topic', () => {
    expect(ancestorKeys('a')).toEqual([])
  })
})

describe('topicSegments and topicLeaf', () => {
  it('splits and takes the last segment', () => {
    expect(topicSegments('Product/Onboarding')).toEqual(['Product', 'Onboarding'])
    expect(topicLeaf('Product/Onboarding')).toBe('Onboarding')
    expect(topicLeaf('Product')).toBe('Product')
  })
})
