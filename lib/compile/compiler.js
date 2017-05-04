'use strict';

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var esTokenizer = require('./es-tokenizer');
var tplTokenizer = require('./tpl-tokenizer');

/** 传递给模板的数据引用 */
var DATA = '$data';

/** 外部导入的所有全局变量引用 */
var IMPORTS = '$imports';

/**  $imports.$escape */
var ESCAPE = '$escape';

/** 文本输出函数 */
var PRINT = 'print';

/** 包含子模板函数 */
var INCLUDE = 'include';

/** 继承布局模板函数 */
var EXTEND = 'extend';

/** “模板块”读写函数 */
var BLOCK = 'block';

/** 字符串拼接变量 */
var OUT = '$$out';

/** 运行时逐行调试记录变量 [line, start, source] */
var LINE = '$$line';

/** 所有“模板块”变量 */
var BLOCKS = '$$blocks';

/** 继承的布局模板的文件地址变量 */
var FROM = '$$from';

/** 导出布局模板函数 */
var LAYOUT = '$$layout';

/** 编译设置变量 */
var OPTIONS = '$$options';

var has = function has(object, key) {
    return object.hasOwnProperty(key);
};
var stringify = JSON.stringify;

var Compiler = function () {

    /**
     * 模板编译器
     * @param   {Object}    options
     */
    function Compiler(options) {
        var _external,
            _internal,
            _dependencies,
            _this = this;

        _classCallCheck(this, Compiler);

        var source = options.source;
        var minimize = options.minimize;
        var htmlMinifier = options.htmlMinifier;

        // 编译选项
        this.options = options;

        // 所有语句堆栈
        this.stacks = [];

        // 运行时注入的上下文
        this.context = [];

        // 模板语句编译后的代码
        this.scripts = [];

        // context map
        this.CONTEXT_MAP = {};

        // 外部变量名单
        this.external = (_external = {}, _external[DATA] = true, _external[IMPORTS] = true, _external[OPTIONS] = true, _external);

        // 按需编译到模板渲染函数的内置变量
        this.internal = (_internal = {}, _internal[OUT] = '\'\'', _internal[LINE] = '[0,0,\'\']', _internal[BLOCKS] = 'arguments[1]||{}', _internal[FROM] = 'null', _internal[LAYOUT] = 'function(){return ' + IMPORTS + '.$include(' + FROM + ',' + DATA + ',' + BLOCKS + ',' + OPTIONS + ')}', _internal[PRINT] = 'function(){' + OUT + '+=\'\'.concat.apply(\'\',arguments)}', _internal[INCLUDE] = 'function(src,data,block){' + OUT + '+=' + IMPORTS + '.$include(src,data||' + DATA + ',block,' + OPTIONS + ')}', _internal[EXTEND] = 'function(from){' + FROM + '=from}', _internal[BLOCK] = 'function(name,callback){if(' + FROM + '){' + OUT + '=\'\';callback();' + BLOCKS + '[name]=' + OUT + '}else{if(typeof ' + BLOCKS + '[name]===\'string\'){' + OUT + '+=' + BLOCKS + '[name]}else{callback()}}}', _internal);

        // 内置函数依赖关系声明
        this.dependencies = (_dependencies = {}, _dependencies[PRINT] = [OUT], _dependencies[INCLUDE] = [OUT, IMPORTS, DATA, OPTIONS], _dependencies[EXTEND] = [FROM, /*[*/LAYOUT /*]*/], _dependencies[BLOCK] = [FROM, OUT, BLOCKS], _dependencies[LAYOUT] = [IMPORTS, FROM, DATA, BLOCKS, OPTIONS], _dependencies);

        this.importContext(OUT);

        if (options.compileDebug) {
            this.importContext(LINE);
        }

        if (minimize) {
            try {
                source = htmlMinifier(source, options);
            } catch (error) {}
        }

        this.source = source;
        this.getTplTokens(source, options.rules, this).forEach(function (tokens) {
            if (tokens.type === tplTokenizer.TYPE_STRING) {
                _this.parseString(tokens);
            } else {
                _this.parseExpression(tokens);
            }
        });
    }

    /**
     * 将模板代码转换成 tplToken 数组
     * @param   {string} source 
     * @return  {Object[]}
     */


    Compiler.prototype.getTplTokens = function getTplTokens() {
        return tplTokenizer.apply(undefined, arguments);
    };

    /**
     * 将模板表达式转换成 esToken 数组
     * @param   {string} source 
     * @return  {Object[]}
     */


    Compiler.prototype.getEsTokens = function getEsTokens(source) {
        return esTokenizer(source);
    };

    /**
     * 获取变量列表
     * @param {Object[]} esTokens
     * @return {string[]}
     */


    Compiler.prototype.getVariables = function getVariables(esTokens) {
        var ignore = false;
        return esTokens.filter(function (esToken) {
            return esToken.type !== 'whitespace' && esToken.type !== 'comment';
        }).filter(function (esToken) {
            if (esToken.type === 'name' && !ignore) {
                return true;
            }

            ignore = esToken.type === 'punctuator' && esToken.value === '.';

            return false;
        }).map(function (tooken) {
            return tooken.value;
        });
    };

    /**
     * 导入模板上下文
     * @param {string} name 
     */


    Compiler.prototype.importContext = function importContext(name) {
        var _this2 = this;

        var value = '';
        var internal = this.internal;
        var dependencies = this.dependencies;
        var external = this.external;
        var context = this.context;
        var options = this.options;
        var ignore = options.ignore;
        var imports = options.imports;
        var contextMap = this.CONTEXT_MAP;

        if (!has(contextMap, name) && !has(external, name) && ignore.indexOf(name) < 0) {

            if (has(internal, name)) {
                value = internal[name];

                if (has(dependencies, name)) {
                    dependencies[name].forEach(function (name) {
                        return _this2.importContext(name);
                    });
                }

                // imports 继承了 Global，但是继承的属性不分配到顶级变量中，避免占用了模板内部的变量名称
            } else if (has(imports, name)) {
                value = IMPORTS + '.' + name;
            } else {
                value = DATA + '.' + name;
            }

            contextMap[name] = value;
            context.push({
                name: name,
                value: value
            });
        }
    };

    /**
     * 解析字符串（HTML）直接输出语句
     * @param {Object} tplToken 
     */


    Compiler.prototype.parseString = function parseString(tplToken) {

        var source = tplToken.value;

        if (!source) {
            return;
        }

        var code = OUT + '+=' + stringify(source);
        this.scripts.push({
            source: source,
            tplToken: tplToken,
            code: code
        });
    };

    /**
     * 解析逻辑表达式语句
     * @param {Object} tplToken 
     */


    Compiler.prototype.parseExpression = function parseExpression(tplToken) {
        var _this3 = this;

        var source = tplToken.value;
        var script = tplToken.script;
        var output = script.output;
        var code = script.code;

        if (output) {
            if (escape === false || output === tplTokenizer.TYPE_RAW) {
                code = OUT + '+=' + script.code;
            } else {
                code = OUT + '+=' + ESCAPE + '(' + script.code + ')';
            }
        }

        var esToken = this.getEsTokens(code);
        this.getVariables(esToken).forEach(function (name) {
            return _this3.importContext(name);
        });

        this.scripts.push({
            source: source,
            tplToken: tplToken,
            code: code
        });
    };

    /**
     * 检查解析后的模板语句是否存在语法错误
     * @param  {string} script 
     * @return {boolean}
     */


    Compiler.prototype.checkExpression = function checkExpression(script) {

        // 没有闭合的块级模板语句规则
        var rules = [

        // <% } %>
        // <% }else{ %>
        // <% }else if(a){ %>
        [/^\s*}[\w\W]*?{?[\s;]*$/, ''],

        // <% list.forEach(function(a,b){ %>
        [/(^[\w\W]*?\s*function\s*\([\w\W]*?\)\s*{[\s;]*$)/, '$1})'],

        // <% list.forEach((a,b)=>{ %>
        [/(^.*?\(\s*[\w\W]*?=>\s*{[\s;]*$)/, '$1})'],

        // <% if(a){ %>
        // <% for(var i in d){ %>
        [/(^[\w\W]*?\([\w\W]*?\)\s*{[\s;]*$)/, '$1}']];

        var index = 0;
        while (index < rules.length) {
            if (rules[index][0].test(script)) {
                var _script;

                script = (_script = script).replace.apply(_script, rules[index]);
                break;
            }
            index++;
        };

        try {
            new Function(script);
            return true;
        } catch (e) {
            return false;
        }
    };

    /**
     * 编译
     * @return  {function}
     */


    Compiler.prototype.build = function build() {

        var options = this.options;
        var context = this.context;
        var scripts = this.scripts;
        var stacks = this.stacks;
        var source = this.source;
        var filename = options.filename;
        var imports = options.imports;
        var mappings = [];
        var extendMode = has(this.CONTEXT_MAP, EXTEND);

        var offsetLine = 0;

        // Create SourceMap: mapping
        var mapping = function mapping(code, _ref) {
            var line = _ref.line,
                start = _ref.start;

            var node = {
                generated: {
                    line: stacks.length + offsetLine + 1,
                    column: 1
                },
                original: {
                    line: line + 1,
                    column: start + 1
                }
            };

            offsetLine += code.split(/\n/).length - 1;
            return node;
        };

        // Trim code
        var trim = function trim(code) {
            return code.replace(/^[\t ]+|[\t ]$/g, '');
        };

        stacks.push('function(' + DATA + '){');
        stacks.push('\'use strict\'');
        stacks.push('var ' + context.map(function (_ref2) {
            var name = _ref2.name,
                value = _ref2.value;
            return name + '=' + value;
        }).join(','));

        if (options.compileDebug) {

            stacks.push('try{');

            scripts.forEach(function (script) {

                if (script.tplToken.type === tplTokenizer.TYPE_EXPRESSION) {
                    stacks.push(LINE + '=[' + [script.tplToken.line, script.tplToken.start, stringify(script.source)].join(',') + ']');
                }

                mappings.push(mapping(script.code, script.tplToken));
                stacks.push(trim(script.code));
            });

            stacks.push('}catch(error){');

            stacks.push('throw {' + ['name:\'RuntimeError\'', 'path:' + stringify(filename), 'message:error.message', 'line:' + LINE + '[0]+1', 'column:' + LINE + '[1]+1', 'source:' + LINE + '[2]', 'stack:error.stack'].join(',') + '}');

            stacks.push('}');
        } else {
            scripts.forEach(function (script) {
                mappings.push(mapping(script.code, script.tplToken));
                stacks.push(trim(script.code));
            });
        }

        stacks.push(extendMode ? 'return ' + LAYOUT + '()' : 'return ' + OUT);
        stacks.push('}');

        var renderCode = stacks.join('\n');

        try {
            var result = new Function(IMPORTS, OPTIONS, 'return ' + renderCode)(imports, options);
            result.mappings = mappings;
            result.sourcesContent = [source];
            return result;
        } catch (error) {

            var index = 0;
            var line = 0;
            var start = 0;
            var source2 = source;

            while (index < scripts.length) {
                var current = scripts[index];
                if (!this.checkExpression(current.code)) {
                    source2 = current.source;
                    line = current.tplToken.line;
                    start = current.tplToken.start;
                    break;
                }
                index++;
            };

            throw {
                name: 'CompileError',
                path: filename,
                message: error.message,
                line: line + 1,
                column: start + 1,
                source: source2,
                script: renderCode,
                stack: error.stack
            };
        }
    };

    return Compiler;
}();

;

/**
 * 模板内置常量
 */
Compiler.CONSTS = {
    DATA: DATA,
    IMPORTS: IMPORTS,
    PRINT: PRINT,
    INCLUDE: INCLUDE,
    EXTEND: EXTEND,
    BLOCK: BLOCK,
    OPTIONS: OPTIONS,
    OUT: OUT,
    LINE: LINE,
    BLOCKS: BLOCKS,
    FROM: FROM,
    LAYOUT: LAYOUT,
    ESCAPE: ESCAPE
};

module.exports = Compiler;