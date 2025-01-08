export class Config {
    static FEE_CONFIG = {
        buyFeeRate: 0.025,
        sellFeeRate: 0.025,
    };
    static PERCENT_CONFIG = {
        delistingTime: 5,      // 상장폐지 기간
        viewPercentage: 100,   // 조회수 배율
        likePercentage: 1000,   // 좋아요수 배율
        viewFirstPrice: 100000,// 조회수 초기 금액
        likeFirstPrice: 100000,// 좋아요수 초기 금액
    }
}