/** Units of measure available across inventory. */
export const UNITS = [
  { value: 'pc', label: 'Piece (pc)' },
  { value: 'kg', label: 'Kilogram (kg)' },
  { value: 'lb', label: 'Pounds (lb)' },
  { value: 'in', label: 'Inch' },
  { value: 'ft', label: 'Feet' },
  { value: 'm', label: 'Meter' },
  { value: 'L', label: 'Liter' },
  { value: 'gal', label: 'Gallon' },
  { value: 'sqft', label: 'SqFeet' },
  { value: 'sqm', label: 'SqMeter' },
] as const

export type UnitValue = (typeof UNITS)[number]['value']
