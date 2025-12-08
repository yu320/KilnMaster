import { FiringSegment, SampleType, FiringStage, calculateTheoreticalDuration } from "../types";

export const generateSchedule = (
    type: SampleType,
    stage: FiringStage,
    clayWeight: number
): { segments: FiringSegment[], warnings: string[], advice: string[], estimatedDurationMinutes: number, timeModifier: number } => {
    const segments: FiringSegment[] = [];
    const warnings: string[] = [];
    const advice: string[] = [];
    let timeModifier = 1.0;

    // 1. 根據樣品類型調整時間係數
    switch (type) {
        case 'thick':
            timeModifier = 1.25; 
            advice.push("📦 選擇【厚胎】：升溫速率會自動設定較低。");
            break;
        case 'sculpture':
            timeModifier = 1.35;
            advice.push("🗿 選擇【複雜雕塑】：已優化 200°C 以下和 573°C 附近的速率。");
            break;
        case 'large_flat':
            timeModifier = 1.10;
            advice.push("🍽️ 選擇【大盤/平板】：573°C 附近已放緩，請注意裝窯平整。");
            break;
        case 'thin':
            timeModifier = 0.9;
            advice.push("✨ 選擇【薄胎】：排程已稍微加快。");
            break;
        case 'standard':
        default:
            timeModifier = 1.0;
            break;
    }

    if (clayWeight > 5) {
        timeModifier += 0.10; 
        advice.push(`⚖️ 總重超過 5kg，熱負載較大，排程時間額外增加約 10%。`);
    }

    // 2. 確定階段參數
    let peakTemp = 0;      
    let lowRampRate = 0;   // 0-120°C
    let midRampRate = 0;   // 120-600°C
    let mainRampRate = 0;  // 600°C+
    let peakHoldTime = 0;  
    let coolRate = 0;      

    if (stage === 'bisque') {
        peakTemp = 800;
        peakHoldTime = 10;
        lowRampRate = (type === 'thick' || type === 'sculpture') ? 60 : 100;
        midRampRate = (type === 'thick' || type === 'sculpture' || type === 'large_flat') ? 100 : 150;
        mainRampRate = 180;
        coolRate = -200; 
        advice.push("🔥 素燒模式：目標 800°C，已加入低溫慢速區段。");
    } else if (stage === 'glaze') {
        peakTemp = 1240; 
        peakHoldTime = (type === 'large_flat' || type === 'thick') ? 30 : 20;
        lowRampRate = 120;
        midRampRate = (type === 'large_flat') ? 100 : 150; 
        mainRampRate = 220; 
        coolRate = -100; 
        advice.push("✨ 釉燒模式：目標 1240°C，已設定 900°C 控溫冷卻段。");
    } else {
        warnings.push("⚠️ 請選擇【素燒】或【釉燒】以獲得最佳建議排程。");
        return { segments: [], warnings, advice, estimatedDurationMinutes: 0, timeModifier: 1.0 };
    }

    // 3. 建立排程區段
    
    // 3.1. 烘乾與低溫預熱 (25°C -> 120°C)
    segments.push({ id: crypto.randomUUID(), type: 'ramp', rate: lowRampRate, targetTemp: 120 });
    
    if (type === 'thick' || type === 'sculpture') {
        segments.push({ id: crypto.randomUUID(), type: 'hold', targetTemp: 120, holdTime: 60 });
    }

    // 3.2. 有機物燃燒與水汽排出 (120°C -> 600°C)
    segments.push({ id: crypto.randomUUID(), type: 'ramp', rate: midRampRate, targetTemp: 600 });
    
    // 3.3. 主升溫區 (600°C -> PeakTemp)
    segments.push({ id: crypto.randomUUID(), type: 'ramp', rate: mainRampRate, targetTemp: peakTemp });

    // 3.4. 峰值保溫
    if (peakHoldTime > 0) {
        segments.push({ id: crypto.randomUUID(), type: 'hold', targetTemp: peakTemp, holdTime: peakHoldTime });
    }

    // 3.5. 控溫冷卻 (PeakTemp -> 900°C/700°C)
    const coolToTemp = (stage === 'glaze' && peakTemp > 1200) ? 900 : 700;
    segments.push({ id: crypto.randomUUID(), type: 'ramp', rate: coolRate, targetTemp: coolToTemp });

    // 3.6. 最終自然冷卻 (900°C/700°C -> 25°C)
    segments.push({ id: crypto.randomUUID(), type: 'ramp', rate: -9999, targetTemp: 25 });
    
    // 4. 計算總時間
    let theoreticalDuration = calculateTheoreticalDuration(segments);
    theoreticalDuration = Math.round(theoreticalDuration * timeModifier);
    
    return { 
        segments, 
        warnings, 
        advice, 
        estimatedDurationMinutes: theoreticalDuration,
        timeModifier
    };
};