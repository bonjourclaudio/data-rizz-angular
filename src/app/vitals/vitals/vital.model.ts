// vital model
export interface Vital {
    vitalName: string;
    unit: string;
    numVal: number;
    minVal: number;
    maxVal: number;
    active: boolean;
    color: string;
    category?: 'essential' | 'heart' | 'brain' | 'other';
}