export interface ScaleDefinition {
  id: string;
  name: string;
  intervals: number[];
  description: string;
}

export const SCALES: ScaleDefinition[] = [
  {
    id: 'major',
    name: 'ماژور',
    intervals: [0, 2, 4, 5, 7, 9, 11, 12],
    description: 'فاصله‌های ۲-۲-۱-۲-۲-۲-۱',
  },
  {
    id: 'natural_minor',
    name: 'مینور طبیعی',
    intervals: [0, 2, 3, 5, 7, 8, 10, 12],
    description: 'فاصله‌های ۲-۱-۲-۲-۱-۲-۲',
  },
  {
    id: 'harmonic_minor',
    name: 'مینور هارمونیک',
    intervals: [0, 2, 3, 5, 7, 8, 11, 12],
    description: 'فاصله‌های ۲-۱-۲-۲-۱-۳-۱',
  },
  {
    id: 'major_pentatonic',
    name: 'پنتاتونیک ماژور',
    intervals: [0, 2, 4, 7, 9, 12],
    description: 'فاصله‌های ۲-۲-۳-۲-۳',
  },
  {
    id: 'blues',
    name: 'بلوز',
    intervals: [0, 3, 5, 6, 7, 10, 12],
    description: 'فاصله‌های ۳-۲-۱-۱-۳-۲',
  },
  {
    id: 'chromatic',
    name: 'کروماتیک',
    intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    description: 'همه فاصله‌ها نیم‌پرده',
  },
];

export function getScaleFrequencies(intervals: number[], baseMidi: number): number[] {
  return intervals.map(i => 440 * Math.pow(2, (baseMidi + i - 69) / 12));
}
