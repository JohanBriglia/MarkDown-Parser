function domConstruction() {
    let globalContainer = createElement("div", document.body, 
        {id:"globalContainer"}
    );
    let inputContainer = createElement("div", globalContainer, 
        {id:"inputContainer"}, 
        {float:"left", width:"49%"}
    );
    let inputTextArea = createElement("textarea", inputContainer, 
        {id:"inputText", placeholder:"Write a new Markdown here...", autofocus:true, rows:10},
        {width:"99%", height:"400px", padding:"10px"}
    );
    let exportButton = createElement("button", inputContainer, 
        {type:"button", innerHTML:"Export"}, 
        {float:"right"}
    );
    let dropdown = createElement("select", inputContainer, {}, 
        {float:"right"}
    );
    exportTypeList.forEach(function(typeElement) {
        createElement("option", dropdown, 
            {value:typeElement, innerHTML:typeElement}
        );
    });
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
    let aTree = parserLewis.parse(someText);
    let aDom = new MDDom({parentElement: aDiv, tree: aTree});
    aDom.visitAll();
    let html = new MDHtml({tree: aTree});
    console.log(html.visitAll());
};



/*
 * Classes
**/

class MDParser {

    parse(aString) {
        this.parentNode = new MDNode();
        this.parentNode.level = 0;
        this.rows = aString.split('\n\n');
        this.currentParentNode = this.parentNode;
        this.rows.forEach((eachRow) => this.parseRow(eachRow));
        return this.parentNode.children;
    };

    parseRow(aString) {
        if (aString[0] == "#") {
            let aTitle = this.parseTitle(aString);
            let aParent = this.currentParentNode.getUpperLevel(aTitle.level - 1);
            aTitle.setNumber(+aParent.maxTitleChildrenNumber() + 1);
            aParent.add(aTitle);
            this.currentParentNode = aTitle;
        } else {
            this.currentParentNode.add(this.parseParagraph(aString));
        };
    };

    parseTitle(aString) {
        let i = 0;
        while (aString[i] == "#") {
            i++
        };
        return new MDTitle({level:i , text:aString.slice(i).trim()});
    };

    parseParagraph(aString) {
        return new MDParagraph({children: this.parseSentence(aString)});
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
            sentences.push(new MDText(aString.slice(0, minPosition)))
            if (minPosition + aTypo.length == aString.length) { return sentences };
        };
        let maxPosition = aString.slice(minPosition + aTypo.length).indexOf(aTypo);
        if (maxPosition == -1) {
            sentences.push(...this.parseSentence(aString.slice(minPosition + aTypo.length)));
        } else {
            let typedString = aString.slice(minPosition + aTypo.length, minPosition + maxPosition + aTypo.length);
            let typoed = this.parseTypo(typedString, aTypo);
            sentences.push(...typoed);
            if ((maxPosition + aTypo.length) < (aString.length - aTypo.length - minPosition)) {
                sentences.push(
                    ...this.parseSentence(aString.slice(minPosition + maxPosition + aTypo.length)))
            };
        };
        return sentences;
    };

    parseTypo(aString, aTypo) {
        return this.parseSentence(aString).map(function(each) {
            switch (aTypo) {
                case "**":
                    return each.setAsBold();
            };
        });
    };
};

class MDText {
    constructor(aString) {
        this.text = aString;
    };

    setAsBold() {
        return new MDBold({children:[this]});
    };

    accept(aVisitor) {
        return aVisitor.visitText(this);
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
        let titles = this.children.filter(item => item.isTitle());
        return titles.length == 0 ? 0 : [titles[titles.length - 1].number];
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
        if (this.level == anInteger) {
            return this;
        } else if (this.level > anInteger) {
            return this.parent.getUpperLevel(anInteger);
        } else {
            throw "you can't get lower levels with this function";
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

class MDBold extends MDNode {
    accept(aVisitor) {
        return aVisitor.visitBold(this);
    };
};


class MDVisitor {
    constructor ({tree}) {
        this.tree = tree;
    }

    visit(item) {
        return item.accept(this);
    };

    visitAll() {
        return this.tree.map((item) => this.visit(item));
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
            {innerText: `${levelsTree}. ${item.text}`});
        let underTheDom = new MDDom({parentElement: this.parent, tree: item.children});
        underTheDom.visitAll();  
    };

    visitParagraph(item) {
        this.visitNode("p", item);
    };

    visitBold(item) {
        this.visitNode("b", item);
    };

    visitText(item) {
        let text = document.createTextNode(item.text);
        this.parent.appendChild(text);
    };

    visitNode(type, item) {
        let node = createElement(type, this.parent);
        let underTheDom = new MDDom({parentElement: node, tree: item.children});
        underTheDom.visitAll();
    };
};

class MDHtml extends MDVisitor {
    visitTitle(item) {
        let hLevel = Math.min(item.level, 6);
        let levelsTree = item.getUpperNumbers().join('.');
        let html = this.setAsHTML(`${levelsTree}. ${item.text}`, `h${hLevel}`);
        let visitor = new MDHtml({tree:item.children});
        return html + visitor.visitAll();
    };

    visitParagraph(item) {
        let visitor = new MDHtml({tree:item.children});
        let html = visitor.visitAll();
        return this.setAsHTML(html, "p");
    };

    visitBold(item) {
        let visitor = new MDHtml({tree:item.children});
        let html = visitor.visitAll();
        return this.setAsHTML(html, "b");
    };

    visitText(item) {
        return item.text;
    };

    setAsHTML(text, type) {
        return `<${type}>${text}</${type}>`
    };

    visitAll() {
        let anArray = this.tree.map((item) => this.visit(item));
        let body = anArray.join("");
        return `<!DOCTYPE html><html><head><title>MarkDown</title></head><body>${body}</body></html>`;
    };
};

let typoTypes = ["**"],
    exportTypeList = ["HTML", "MediaWiki"],
    parserLewis = new MDParser();

domConstruction();
