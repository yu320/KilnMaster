export type SampleType = 'standard' | 'thick' | 'thin' | 'large_flat' | 'sculpture';
export type FiringStage = 'bisque' | 'glaze' | 'uncertain';

export const sampleTypeLabels: Record<SampleType, string> = {
  'standard': '標準器物 (一般厚度)',
  'thick': '厚胎 / 厚壁 (1.5cm+)',
  'thin': '薄胎 / 精細件',
  'large_flat': '大盤 / 平板 (易變形)',
  'sculpture': '複雜雕塑 (厚薄不均)'
};

export const FiringStageLabels: Record<FiringStage, string> = {
  'bisque': '素燒 (Bisque)',
  'glaze': '釉燒 (Glaze)',
  'uncertain': '不確定 / 自訂排程'
};

export interface FiringSegment {
  id: string;
  type: 'ramp' | 'hold';
  rate?: number; // Degrees per hour (only for ramp)
  targetTemp: number; // Target temperature in Celsius
  holdTime?: number; // Minutes to hold (only for hold/soak)
}

export interface FiringSchedule {
  id: string;
  name: string;
  segments: FiringSegment[];
  estimatedDurationMinutes: number;
  clayWeight?: number; 
  sampleType?: SampleType;
  firingStage?: FiringStage;
}

export interface FiringLog {
  id: string;
  scheduleName: string;
  date: string;
  predictedDuration: number; 
  theoreticalDuration?: number; 
  actualDuration: number; 
  clayWeight?: number; 
  sampleType?: SampleType; 
  firingStage?: FiringStage;
  notes: string;
  outcome: 'perfect' | 'underfired' | 'overfired' | 'error' | 'failure';
}

export interface CalibrationResult {
  factor: number; 
  advice: string;
}

export interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
}

export const outcomeMap: Record<string, string> = {
  'perfect': '完美',
  'underfired': '溫度不足',
  'overfired': '過溫',
  'error': '錯誤',
  'failure': '失敗'
};

export const createEmptySegment = (): FiringSegment => ({
  id: crypto.randomUUID(),
  type: 'ramp',
  rate: 150,
  targetTemp: 600,
  holdTime: 0,
});

export const calculateTheoreticalDuration = (segments: FiringSegment[]): number => {
  let totalMinutes = 0;
  let currentTemp = 25;

  segments.forEach(seg => {
    if (seg.type === 'ramp') {
      const rate = seg.rate ?? 0;
      const target = seg.targetTemp;
      // 處理升溫與降溫
      if (rate !== 0) {
        const tempDiff = Math.abs(target - currentTemp);
        totalMinutes += (tempDiff / Math.abs(rate)) * 60;
      }
      currentTemp = target;
    } else if (seg.type === 'hold') {
      totalMinutes += seg.holdTime ?? 0;
    }
  });

  return Math.round(totalMinutes);
};

export const calculateSchedulePoints = (segments: FiringSegment[]) => {
  let currentTemp = 25;
  let currentTime = 0;
  const points = [{ time: 0, temp: 25 }];

  segments.forEach(seg => {
    if (seg.type === 'hold') {
      currentTime += seg.holdTime || 0;
      points.push({ time: currentTime, temp: currentTemp });
    } else if (seg.type === 'ramp' && seg.rate && seg.rate !== 0) {
      const diff = Math.abs(seg.targetTemp - currentTemp);
      const minutes = (diff / Math.abs(seg.rate)) * 60;
      currentTime += minutes;
      currentTemp = seg.targetTemp;
      points.push({ time: currentTime, temp: currentTemp });
    }
  });

  return points;
};