function domConstruction() {
    let globalContainer = createElement("div", document.body, 
        {id:"globalContainer"}
    );
    createElement("h1", globalContainer,
        {innerHTML:"MarkDown Parser"});
    let inputContainer = createElement("div", globalContainer, 
        {id:"inputContainer"}, 
        {float:"left", width:"49%"}
    );
    let inputTextArea = createElement("textarea", inputContainer, 
        {id:"inputText", placeholder:"Write a new Markdown here...", autofocus:true, rows:10},
        {width:"99%", height:"400px", padding:"10px"}
    );
    exportButton = createElement("a", inputContainer
    );
    createElement("button", exportButton, 
        {type:"button", innerHTML:"Export"}, 
        {float:"right", padding: "10px"}
    );
    dropdown = createElement("select", inputContainer, {}, 
        {float:"right", padding: "10px"}
    );
    exportTypeList.forEach(function(typeElement) {
        createElement("option", dropdown, 
            {value:typeElement, innerHTML:typeElement}
        );
    });
    dropdown.addEventListener("change", function() {
        refreshOverview(inputTextArea.value, overviewContainer);
    });
    errorCatcher = createElement("div", inputContainer, {},
        {float: "right", padding: "10px", color: "#ff0000", style: "bold"}
    );
    let overviewContainer = createElement("div", globalContainer,
        {id:"overviewContainer"},
        {float:"right", width:"49%",}
    );
    inputTextArea.addEventListener("keyup", function() {
        refreshOverview(this.value, overviewContainer);
    });
};

/*
 * generic function to create an html element, initialize it, and add it to a node
 * ex: let inputText = createElement("input", container, {id:"add-todo",type:"text",autofocus:true});
**/

function createElement(type, parent, options, styles) { // options and styles are optionnal
    let opt = options || {},
        sty = styles || {};
    let foo = document.createElement(type);
    for (var key in opt) {
        foo[key] = opt[key];
    };
    for (var key in sty) {
        foo.style[key] = sty[key];
    };
    parent.appendChild(foo);
    return foo;
};

function refreshOverview(someText, aDiv) {
    aDiv.innerHTML = "";
    errorCatcher.innerHTML = "";
    window.URL.revokeObjectURL(downloadURL);

    let aTree = parserLewis.parse(someText);
    let aDom = new MDDom({parentElement: aDiv});
    aDom.visitAll(aTree);

    let blob;
    switch (dropdown.options[dropdown.selectedIndex].text) {
        case "HTML":
            let htmlVisitor = new MDHtml();
            let html = htmlVisitor.setAsHTML(aTree);
            blob = new Blob([html], {type: 'text/html'});
            exportButton.download = "MarkDown HTML file.html";
            break;
        case "MediaWiki":
            let wikiVisitor = new MDMediaWiki();
            let wikiText = wikiVisitor.visitAll(aTree);
            blob = new Blob([wikiText], {type: 'text/html'});
            exportButton.download = "MarkDown WikiMedia file.txt";
            break;
    };
    downloadURL = window.URL.createObjectURL(blob);
    exportButton.href = downloadURL;
};

/*
 * Classes
**/

class MDParser {

    parse(aString) {
        this.codeParsing = false;
        this.parentNode = new MDNode();
        this.parentNode.level = 0;
        this.rows = aString.split('\n\n');
        this.currentParentNode = this.parentNode;
        this.rows.forEach((eachRow) => this.parseRow(eachRow));
        return this.parentNode.children;
    };

    parseRow(aString) {
        if (this.codeParsing) {
            if (aString.startsWith("```") || aString.startsWith("\n```")) {
                return this.parseCode(aString);
            };
            if (aString.endsWith("```") || aString.endsWith("\n```")) {
                this.currentParentNode.add(new MDText(aString.slice(0, aString.indexOf("```")) + "\n\n"));
                return this.parseCode("\n```");
            };
            this.currentParentNode.add(new MDText(aString + "\n\n"));
        } else {
            let stringToParse = aString.startsWith("\n") ? aString.slice(1) : aString;
            switch (stringToParse[0]) {
                case "#":
                    this.parseTitle(stringToParse);
                    break;
                case "-":
                    this.parseList(stringToParse);
                    break;
                case "`":
                    stringToParse.startsWith("```") ? this.parseCode(aString) : this.parseParagraph(stringToParse);
                    break;
                default:
                    this.parseParagraph(stringToParse);
            };
        };
    };

    parseTitle(aString) {
        let i = 0;
        while (aString[i] == "#") {
            i++
        };
        let aTitle = new MDTitle({level:i , text:aString.slice(i).trim()});
        let aParent = this.currentParentNode.getUpperLevel(aTitle.level - 1);
        aTitle.setNumber(+aParent.maxTitleChildrenNumber() + 1);
        aParent.add(aTitle);
        this.currentParentNode = aTitle;
    };

    parseParagraph(aString) {
        let children = this.parseSentence(aString);
        let aParagraph = new MDParagraph({children: children});
        this.currentParentNode.add(aParagraph);
    };

    parseList(aString) {
        let children = this.parseSentence(aString.slice(1));
        let aListItem = new MDListItem({children: children});
        if (this.currentParentNode.lastChildren().isList()) {
            this.currentParentNode.lastChildren().add(aListItem);
        } else {
            let newList = new MDUnorderedList({children: [aListItem]});
            this.currentParentNode.add(newList);
        };
    };

    parseCode(aString) {
        let aRow = aString.startsWith("\n```") ? "\n" + aString.slice(4) : aString.slice(3);
        if (this.codeParsing) {
            this.codeParsing = false;
            this.currentParentNode = this.currentParentNode.parent;
        } else {
            this.codeParsing = true;
            let codeNode = new MDCodeNode();
            this.currentParentNode.add(codeNode);
            this.currentParentNode = codeNode;
        };
        this.parseRow(aRow)
    };

    parseSentence(aString) {
        let typesPositions = typoTypes.map((eachType) => aString.indexOf(eachType));
        let positions = typesPositions.filter(pos => pos != -1); 
        if (positions.length == 0) {
            return [new MDText(aString)];
        }; 
        let minPosition = Math.min(...positions);
        let minTypoPosition = typesPositions.indexOf(minPosition);
        let nextTypo = typoTypes[minTypoPosition];
        return this.parseItem(aString, minPosition, nextTypo);
    };

    parseItem(aString, minPosition, aTypo) {
        let sentences = [];
        if (minPosition > 0) {
            let previousSentence = aString.slice(0, minPosition);
            sentences.push(new MDText(previousSentence));
            if (minPosition + aTypo.length == aString.length) { 
                return sentences;
            };
        };

        let maxPosition = aString.slice(minPosition + aTypo.length).indexOf(aTypo);
        if (maxPosition == -1) {
            sentences.push(...this.parseSentence(aString.slice(minPosition + aTypo.length)));
        } else {
            let currentSentence = aString.slice(minPosition + aTypo.length, minPosition + aTypo.length + maxPosition);
            let parsedTypo = this.parseTypo(currentSentence, aTypo);
            sentences.push(parsedTypo);

            if ((maxPosition + aTypo.length) < (aString.length - aTypo.length - minPosition)) {
                let nextSentence = aString.slice(minPosition + aTypo.length + maxPosition + aTypo.length);
                sentences.push(...this.parseSentence(nextSentence));
            };
        };
        return sentences;
    };

    parseTypo(aString, aTypo) {
        switch (aTypo) {
            case "**":
                return new MDBold({children: this.parseSentence(aString)});
            case "`":
                return new MDCode(aString);
            case "_":
                return new MDItalic({children: this.parseSentence(aString)});
        };
    };
};

class MDText {
    constructor(aString) {
        this.text = aString;
    };

    accept(aVisitor) {
        return aVisitor.visitText(this);
    };

    setParent(item) {
        this.parent = item;
    };
};

class MDCode extends MDText {
    accept(aVisitor) {
        return aVisitor.visitCode(this);
    };
};

class MDNode {
    constructor({children = []} = {}) {
        this.children = children;
    };

    add(item) {
        this.children.push(item);
        item.setParent(this);
    };

    setParent(item) {
        this.parent = item;
    };

    maxTitleChildrenNumber() {
        return this.children.filter(item => item.isTitle()).length;
    };

    lastChildren() {
        if (this.children.length == 0) {
            return this;
        } else {
            return this.children[this.children.length - 1];
        };
    };

    getUpperLevel(anInteger) {
        return this;
    };

    getUpperNumbers() {
        return [];
    };

    isTitle() {
        return false;
    };

    isList() {
        return false;
    };
};

class MDTitle extends MDNode {
    constructor({level,text}) {
        super(...arguments);
        this.level = level;
        this.text = text;
    };

    accept(aVisitor) {
        return aVisitor.visitTitle(this);
    };

    getUpperLevel(anInteger) {
        try {
            if (this.level == anInteger) {
                return this;
            } else if (this.level > anInteger) {
                return this.parent.getUpperLevel(anInteger);
            } else {
                throw `TITLE ERROR : level ${anInteger} parent title needed`;
            };
        } catch(e) {
            let text = document.createTextNode(e);
            errorCatcher.appendChild(text);
        };
    };

    getUpperNumbers() {
        return [...this.parent.getUpperNumbers(), this.number];
    };

    isTitle() {
        return true;
    };

    setNumber(anInteger) {
        this.number = anInteger;
    };
};

class MDParagraph extends MDNode {
    accept(aVisitor) {
        return aVisitor.visitParagraph(this);
    };
};

class MDUnorderedList extends MDNode {
    isList() {
        return true;
    };

    accept(aVisitor) {
        return aVisitor.visitUnorderedList(this);
    };
};

class MDListItem extends MDNode {
    accept(aVisitor) {
        return aVisitor.visitListItem(this);
    };
};

class MDBold extends MDNode {
    accept(aVisitor) {
        return aVisitor.visitBold(this);
    };
};

class MDItalic extends MDNode {
    accept(aVisitor) {
        return aVisitor.visitItalic(this);
    };
};

class MDCodeNode extends MDNode {
    accept(aVisitor) {
        return aVisitor.visitCodeNode(this);
    };
};


class MDVisitor {
    visit(item) {
        return item.accept(this);
    };

    visitAll(aTree) {
        return aTree.map((item) => this.visit(item));
    };

    setToHTMLCode(aString) {
        let htmlCode = {"&":"&amp;", "<":"&lsaquo;", ">":"&rsaquo;"};
        let codeString = aString;
        for (var key in htmlCode) {
            let reg = new RegExp(key, "g");
            codeString = codeString.replace(reg, htmlCode[key]);
        };
        return codeString;
    };
};

class MDDom extends MDVisitor {
    constructor({parentElement}) {
        super(...arguments);
        this.parent = parentElement;
    };
        
    visitTitle(item) {
        let hLevel = Math.min(item.level, 6);
        let levelsTree = item.getUpperNumbers().join('.');
        createElement(`h${hLevel}`, this.parent,
            {innerText: `${levelsTree}. ${item.text}`}
        );
        let underTheDom = new MDDom({parentElement: this.parent});
        underTheDom.visitAll(item.children);
    };

    visitParagraph(item) {
        this.createNode("p", item);
    };

    visitUnorderedList(item) {
        this.createNode("ul", item);
    };

    visitListItem(item) {
        this.createNode("li", item);
    };

    visitBold(item) {
        this.createNode("strong", item);
    };

    visitItalic(item) {
        this.createNode("i", item);
    };

    visitCodeNode(item) {
        let pre = createElement("pre", this.parent, {},
            {backgroundColor: "silver"}
        );
        let code = createElement("code", pre);
        let underTheDom = new MDDom({parentElement: code});
        underTheDom.visitAll(item.children);
    };

    visitText(item) {
        let text = document.createTextNode(item.text);
        this.parent.appendChild(text);
    };

    visitCode(item) {
        let codeText = this.setToHTMLCode(item.text);
        createElement("code", this.parent,
            {innerHTML: codeText},
            {backgroundColor: "silver"}
        );
    };

    createNode(type, item) {
        let node = createElement(type, this.parent);
        let underTheDom = new MDDom({parentElement: node});
        underTheDom.visitAll(item.children);
        return node;
    };
};

class MDHtml extends MDVisitor {
    visitTitle(item) {
        let hLevel = Math.min(item.level, 6);
        let levelsTree = item.getUpperNumbers().join('.');
        let html = this.setAsHTMLItem(`${levelsTree}. ${item.text}`, `h${hLevel}`);
        return html + '\n\n' + this.visitNode(item);
    };

    visitParagraph(item) {
        return this.setAsHTMLItem(this.visitNode(item), "p") + '\n\n';
    };

    visitUnorderedList(item) {
        let ul = this.setAsHTMLItem(this.visitNode(item), "ul");
        return ul.split("><").join(">\n<") + '\n\n';
    };

    visitListItem(item) {
        return this.setAsHTMLItem(this.visitNode(item), "li");
    };

    visitBold(item) {
        return this.setAsHTMLItem(this.visitNode(item), "strong");
    };

    visitItalic(item) {
        return this.setAsHTMLItem(this.visitNode(item), "i");
    };

    visitText(item) {
        return item.text;
    };

    visitCode(item) {
        let code = this.setToHTMLCode(item.text);
        return `<code style="background-color:silver;">${code}</code>`;
    };

    visitCodeNode(item) {
        let code = this.visitNode(item);
        return `<pre style="background-color:silver;"><code>${code}</code></pre>\n\n`;
    };

    visitNode(item) {
        let visitor = new MDHtml();
        return visitor.visitAll(item.children);
    };

    setAsHTMLItem(text, type) {
        return `<${type}>${text}</${type}>`
    };

    setAsHTML(aTree) {
        let body = this.visitAll(aTree);
        return `<!DOCTYPE html>\n<html>\n<head>\n<title>MarkDown</title>\n</head>\n<body>\n\n${body}</body>\n</html>`;
    };        

    visitAll(aTree) {
        let anArray = aTree.map((item) => this.visit(item));
        return anArray.join("");
    };
};

class MDMediaWiki extends MDVisitor {
    visitTitle(item) {
        let level = "=";
        for (let i = 0 ; i < item.level ; i++) {
            level += "=";
        };
        let children = this.visitAll(item.children);
        return `${level} ${item.text} ${level}\n\n${children}`
    };

    visitParagraph(item) {
        let children = this.visitAll(item.children);
        return `${children}\n\n`;
    };

    visitUnorderedList(item) {
        let children = this.visitAll(item.children);
        return `${children}\n`;
    };

    visitListItem(item) {
        let children = this.visitAll(item.children);
        return `*${children}\n`;
    };

    visitBold(item) {
        let children = this.visitAll(item.children);
        return `'''${children}'''`;
    };

    visitItalic(item) {
        let children = this.visitAll(item.children);
        return `''${children}''`;
    };

    visitText(item) {
        return item.text;
    };

    visitCode(item) {
        return `<nowiki>${item.text}</nowiki>`;
    };

    visitCodeNode(item) {
        let children = this.visitAll(item.children);
        return `<nowiki>${children}</nowiki>`;
    };

    visitAll(aTree) {
        let anArray = aTree.map((item) => this.visit(item));
        return anArray.join("");
    };
};

let typoTypes = ["**", "`", "_",],
    exportTypeList = ["HTML", "MediaWiki"],
    parserLewis = new MDParser(),
    errorCatcher,
    exportButton,
    dropdown,
    downloadURL;

domConstruction();
