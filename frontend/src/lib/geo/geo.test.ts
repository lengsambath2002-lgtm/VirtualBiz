import { describe, expect, it } from 'vitest';

import { matchDistrict, streetLine } from './index';

describe('matchDistrict', () => {
  it('maps OSM khan/sangkat spellings to our districts', () => {
    expect(matchDistrict({ city_district: 'Khan Tuol Kouk' })).toBe('Toul Kork');
    expect(matchDistrict({ suburb: 'Sangkat Boeng Keng Kang Ti Muoy' })).toBe('BKK1');
    expect(matchDistrict({ city_district: 'Khan Saensokh' })).toBe('Sen Sok');
    expect(matchDistrict({ suburb: 'Phsar Thmei', city_district: 'Daun Penh' })).toBe('Daun Penh');
  });
  it('reads the khan from town, in Khmer or English', () => {
    expect(matchDistrict({ village: 'សង្កាត់ភ្នំពេញថ្មី', town: 'ខណ្ឌសែនសុខ' })).toBe('Sen Sok');
    expect(matchDistrict({ village: 'សង្កាត់បឹងកេងកងទី ១', town: 'ខណ្ឌបឹងកេងកង' })).toBe('BKK1');
    expect(matchDistrict({ town: 'Khan Tuol Kouk' })).toBe('Toul Kork');
  });
  it('returns null outside our districts', () => {
    expect(matchDistrict({ city: 'Siem Reap' })).toBeNull();
  });
});

describe('streetLine', () => {
  it('prefers house number + road', () => {
    expect(streetLine({ house_number: '12', road: 'Street 516' })).toBe('#12, Street 516');
    expect(streetLine({ road: 'Monivong Blvd' })).toBe('Monivong Blvd');
    expect(streetLine({ neighbourhood: 'Phsar Depou' })).toBe('Phsar Depou');
  });
});
