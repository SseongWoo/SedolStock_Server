export class Config {
    static FEE_CONFIG = {
        buyFeeRate: 0.02,
        sellFeeRate: 0.02,
    };
    static PERCENT_CONFIG = {
        delistingTime: 5,      // 상장폐지 기간
        percentage: 100,   // 배율
        firstPrice: 100000,// 초기 금액
        lowerLimitPersent: 50, // 최소 하한가
    }
}