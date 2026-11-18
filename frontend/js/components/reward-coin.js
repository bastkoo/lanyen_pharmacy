export function rewardCoin() {
    const coin = document.createElement('span');
    coin.className = 'reward-coin';
    coin.setAttribute('role', 'img');
    coin.setAttribute('aria-label', 'xu');
    return coin;
}
