"use strict";
function init() {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.name = 'file';
    document.body.appendChild(fileInput);
    fileInput.addEventListener('change', (event) => {
        var _a;
        const target = event.target;
        const file = (_a = target.files) === null || _a === void 0 ? void 0 : _a[0];
        if (!file) {
            console.warn(`The file "${file}" is not a valid file`);
            return;
        }
        console.debug(`The file "${file}" is ${file}`);
        // 音声ファイルのオブジェクトURLを作成
        const audioUrl = URL.createObjectURL(file);
        const audio = new Audio(audioUrl);
        // 再生
        audio.play().then(() => {
            console.info('audio played');
        });
    });
}
window.addEventListener('DOMContentLoaded', init);
