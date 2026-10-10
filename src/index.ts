import Player from './player.js';

// 音声プレイヤーの配列
const players: Player[] = [];

// Service Workerの登録（オフライン起動用）
function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
        return;
    }
    // sw.jsはルート直下に置くこと。scopeがdist/配下になるとトップページを制御できない
    navigator.serviceWorker.register('./sw.js').catch((error) => {
        console.warn('Service Workerの登録に失敗しました', error);
    });
}

// 要素の初期化
function init() {
    // 要素の作成
    // ルート要素の作成
    const root = document.createElement('main');
    root.id = 'root';
    document.body.appendChild(root);

    // コンテナ
    const container = document.createElement('div');
    container.id = 'root-container';
    root.appendChild(container);

    // 音声リストのコンテナ
    const audioListContainer = document.createElement('div');
    audioListContainer.id = 'audio-list-container';
    container.appendChild(audioListContainer);

    // ボタンの作成
    const addButton = document.createElement('button');
    addButton.id = 'add-button';
    addButton.textContent = '音声の追加';
    addButton.classList.add('primary-button');
    addButton.dataset.index = '0';
    audioListContainer.appendChild(addButton);

    const removeButton = document.createElement('button');
    removeButton.id = 'remove-button';
    removeButton.textContent = '音声の削除';
    removeButton.classList.add('secondary-button');

    // ボタンのイベントリスナーを追加
    addButton.addEventListener('click', (e) => {
        // 音声の追加処理
        console.log('音声の追加ボタンがクリックされました');
        if (e.target) {
            addPlayer((e.target as HTMLButtonElement).dataset.index);
        }
    });

    removeButton.addEventListener('click', () => {
        // 音声の削除処理（末尾のプレイヤーを削除する）
        console.log('音声の削除ボタンがクリックされました');
        const player = players[players.length - 1];
        if (player) {
            removePlayer(player);
            player.destroy();
        }
    });

    function addPlayer(index: string | undefined) {
        // 音声の追加処理
        console.log(`音声が追加されました: ${index}`);
        const player = new Player(audioListContainer, {
            onRemove: (target) => removePlayer(target),
        });
        players.push(player);
    }

    function removePlayer(target: Player) {
        // 音声の削除処理（DOMとオブジェクトURLの解放はPlayer側で行う）
        const index = players.indexOf(target);
        if (index >= 0) {
            players.splice(index, 1);
        }
    }
}
window.addEventListener('DOMContentLoaded', init);
window.addEventListener('load', registerServiceWorker);