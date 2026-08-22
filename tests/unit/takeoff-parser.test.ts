import { describe, expect, it } from 'vitest'
import {
  isTakeoffCsvCandidate,
  parseTakeoffCsv,
} from '@/lib/services/takeoff-parser'

describe('takeoff CSV parser', () => {
  it('selects the real schedule and excludes generated error-log companions', () => {
    expect(
      isTakeoffCsvCandidate({
        filename: 'Panel Schedule (JADE)CLEAN.csv',
        category: 'takeoff',
        isUncertain: false,
      }),
    ).toBe(true)
    expect(
      isTakeoffCsvCandidate({
        filename: 'ErrorLog - Panel Schedule (JADE)CLEAN_csv.csv',
        category: 'other',
        isUncertain: true,
      }),
    ).toBe(false)
  })

  it('parses the standard Elward takeoff format by header name', () => {
    const marks = parseTakeoffCsv({
      csvText: [
        'mark,description,quantity,materialFamily,color,thickness,width,length',
        'P-101,"Fictional, folded panel",2,ACM,Test Gray,0.1570,48,120',
      ].join('\n'),
      filename: 'fictional-takeoff.csv',
      defaultMaterialFamily: 'ACM',
    })

    expect(marks).toEqual([
      expect.objectContaining({
        mark: 'P-101',
        description: 'Fictional, folded panel',
        quantity: 2,
        width: '48',
        length: '120',
      }),
    ])
  })

  it('parses a JADE panel schedule with a title row and metric thickness', () => {
    const marks = parseTakeoffCsv({
      csvText: [
        'Panel Schedule (JADE)',
        'Count,Building Number,Release Number,Priority Level,ESC Mark Number,Family,Material,Material Thickness mm,Stretch out Height,Stretch out Width,Panel Area',
        '3,,2,,J-51,Fictional Equal Space,Carat - Test 0000,8,24.5,48.25,8 SF',
      ].join('\r\n'),
      filename: 'fictional-jade.csv',
      defaultMaterialFamily: 'Swisspearl',
    })

    expect(marks).toEqual([
      {
        mark: 'J-51',
        description: 'Fictional Equal Space',
        quantity: 3,
        materialFamily: 'Swisspearl',
        color: 'Carat - Test 0000',
        thickness: '0.3150',
        width: '48.25',
        length: '24.5',
        dimensionUnit: 'in',
      },
    ])
  })

  it('rejects invalid quantities after resolving aliased headers', () => {
    expect(() =>
      parseTakeoffCsv({
        csvText: 'Count,ESC Mark Number\n0,J-52',
        filename: 'fictional-jade.csv',
        defaultMaterialFamily: 'Swisspearl',
      }),
    ).toThrow("invalid quantity for mark 'J-52'")
  })

  it('parses a validated headerless JADE CLEAN schedule', () => {
    const marks = parseTakeoffCsv({
      csvText: ['J-51,3,24.5,48.25,90', 'J-52,2,30,60,90'].join('\n'),
      filename: 'Fictional Panel Schedule (JADE)CLEAN.csv',
      defaultMaterialFamily: 'Swisspearl',
    })

    expect(marks).toEqual([
      {
        mark: 'J-51',
        description: 'Panel Mark J-51',
        quantity: 3,
        materialFamily: 'Swisspearl',
        width: '48.25',
        length: '24.5',
        dimensionUnit: 'in',
      },
      {
        mark: 'J-52',
        description: 'Panel Mark J-52',
        quantity: 2,
        materialFamily: 'Swisspearl',
        width: '60',
        length: '30',
        dimensionUnit: 'in',
      },
    ])
  })

  it('does not treat arbitrary headerless CSV data as JADE CLEAN', () => {
    expect(() =>
      parseTakeoffCsv({
        csvText: 'J-51,3,24.5,48.25,90',
        filename: 'fictional-unknown.csv',
        defaultMaterialFamily: 'Swisspearl',
      }),
    ).toThrow('must include recognizable mark and quantity columns')
  })
})
