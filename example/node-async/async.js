const path = require('path');
const fs = require('fs');
const util = require('util');

const template = require('../../index');
const readFile = util.promisify(fs.readFile)

const sleep = (delay) => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve("333");
        }, delay);
    })
}

// 自定义标签，可以通过 raw 输出原始内容。remoteValue。为sql查询结果。
template.defaults.rules.push({
    test: /{[ \t]*system\:global\.([\w\W]*?)[ \t]*\/}/,
    async use(match, code) {
        // const rs = await sleep(0)
        const remoteValue = Math.random(1);
        return Promise.resolve({
            code: remoteValue,
            output: 'raw'
        })
    }
});
const data = {
    title: '基本例子',
    isAdmin: true,
    list: ['文艺', '博客', '摄影', '电影', '民谣', '旅行', '吉他']
};

async function start() {
    console.time('count')
    const htmlTemplate = await readFile(path.resolve(__dirname, 'async.art'))
    const html = await template.render(htmlTemplate.toString(), {})
    console.log('html', html)
    console.timeEnd('count')
}

start();