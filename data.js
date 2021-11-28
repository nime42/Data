var DATA = {
  init: function () {
    this._findDataVariables(document.querySelector("body"),undefined);
  },

  _findDataVariables:function(elem,env) {
    console.log("_findDataVariables",elem,env);
    let data = elem.getAttribute("data-var");
      if (data) {
        data=this._adjustEnv(env,elem,data);
        let collectionVar=this._getCollectionVar(data);
        if(collectionVar) {
          this._handleCollectionVar(collectionVar.var,collectionVar.indexVar,elem);
          return;
        } else {
          this._handleDataVar(data,elem,env);
        }
      }
      for(let c of elem.children) {
        this._findDataVariables(c,env);
      }
      return elem;
  },
  _adjustEnv:function(env,elem,data) {
    if(!env) {
      return data;
    } else {
      elem.setAttribute(
        "data-var",
        data.replaceAll(env.var,env.fqn)
      );
      return elem.getAttribute("data-var");
    }

    
  },

  _getCollectionVar:function(data) {
    let collection = /\$\{ *([^ \}]*)\}( *\[ *<([^>]+)> *\])/.exec(data);
    if (collection != null) {
      return {var:collection[1],indexVar:collection[3]};
    } else {
      return null;
    }
  },
  _handleCollectionVar: function (collectionVar, indexVar, elem, env) {
    console.log("_handleCollectionVar",collectionVar, indexVar, elem, env)

    if(!env) {
      env={var:indexVar,fqn:collectionVar+"/"+indexVar};
    } else {
      env={var:indexVar,fqn:env.fqn+"/"+indexVar};
    }
    env.collectionElem=elem;

    for(let c of elem.children) {
      this._findDataVariables(c,env);
    }
    
    this.collections[collectionVar] = {
      indexVar: indexVar,
      template: elem.innerHTML,
      nrOfChildElem:elem.childElementCount,
      element:elem
    };
    for(let c of elem.children) {
      c.remove();
    }

  },

  _handleDataVar:function(data,elem,env) {
    console.log("_handleDataVar",data,elem);
    let vars = data.match(/\$\{[^\}]*\}/g).map((m) => {
      let g = /\$\{ *([^ \}]*) *\}/.exec(m);
      return g[1];
    });
    vars.forEach((v) => {
      if (this.variables[v] === undefined) {
        this.variables[v] = { updateElems: new Set(),updateElemsFromIndex:new Set() };
      }
      this.variables[v].updateElems.add(elem);
      if(env!==undefined) {
        this.variables[v].updateElemsFromIndex.add(this._getElemIndex(env.collectionElem,elem));
      }
      if (elem.value != undefined) {
        this.variables[v].value = elem.value;
      }
      let self = this;
      if (elem.onchange !== undefined) {
        elem.addEventListener("change", (evt) => {
          self.assign(v, evt.target.value);
        });
      }
    });
    if(env!==undefined) {
      if(vars.length===1 && data.match(/^ *\$\{[^\}]+\} *$/)) {
        this.variables[vars[0]].collectionIndex=this._getElemIndex(env.collectionElem,elem);
      }
    }
    this._updateElem(elem, this._evalTemplate(data));


  },
  assign: function (variable, value,parent) {
    let v = this.variables[variable];
    if (v) {
      v.value = value;
      v.updateElems.forEach((u) => {
        value = this._evalTemplate(u.getAttribute("data-var"));
        this._updateElem(u, value);
      });
      let allElems=parent?.getElementsByTagName("*");
      v.updateElemsFromIndex.forEach((i) => {
        let e=allElems[i-1];
        value = this._evalTemplate(e.getAttribute("data-var"),undefined,parent);
        this._updateElem(e, value);

      });
    } else {
      this.variables[variable] = { updateElems: new Set(),updateElemsFromIndex:new Set(), value: value };
    }
  },
  getValue: function (v) {
    return this.variables[v].value;
  },
  getCollectionValue: function(v,index) {
    let col=this.collections[v];
    let elem=col.element;

    let start=0;
    let end=col.element.childElementCount/col.nrOfChildElem;
    if(index!==undefined) {
      start=index;
      end=start+1;

    }
    let re=new RegExp("\\$\\{ *("+v+"/"+col.indexVar+")(?:\\.([^ \\ *}]+))?\\}(?:\\[ *<(.*)> *\\])?");
    let res=[];
    for(let i=start;i<end;i++) {
      let items={};
      let attrVals={};
      for(let c=col.nrOfChildElem*i;c<col.nrOfChildElem*(i+1);c++) {
        let child=elem.children[c];

        [child,...child.querySelectorAll("[data-var]")].forEach(e=>{
          let data=e.getAttribute("data-var");
          try {
            let [dummy,varName,attribute,indexVar]=re.exec(data);
            if(attribute) {
              varName+="."+attribute;
            }
            if(indexVar) {
              this.collections[varName].element=child;
              items[varName]=this.getCollectionValue(varName);
            } else {
              if(e.value) {
                items[varName]=e.value;
              } else {
                items[varName]=e.innerText;
              }
            }
            if(items[v+"/"+col.indexVar]) {
              res.push(items[v+"/"+col.indexVar]);
            } else {
              if(attrVals[attribute.split("/").slice(0,-1)]===undefined) {
                attrVals[attribute]=items[varName]
              }

            }
    
          } catch(err) {

          }

    
        });
        if(Object.keys(attrVals).length>0) {
          res.push(attrVals); 
        }       
      }
  
    }  
    return res;  
  },
  _updateElem: function(el, val) {
    if (el.value !== undefined) {
      el.value = val;
    } else {
      el.innerText = val;
    }
  },
  _evalTemplate: function (template,extraValues,parent) {
    let vars = template.match(/\$\{[^\}]*\}/g).map((e) => {
      return /\$\{ *([^ \}]*) *\}/.exec(e)[1];
    });
    let value = template;
    vars.forEach((v) => {
      let re = new RegExp("\\$\\{ *" + v + " *\\}");
      let newVal=this._getValue(v,parent);
      if( extraValues && extraValues[v]) {
        newVal=extraValues[v];
      }
      value = value.replace(re, newVal);
    });
    try {
      value = eval(value);
    } catch (err) {}
    return value;
  },
  _parseHtml: function (html) {
    var t = document.createElement("template");
    t.innerHTML = html;
    return t.content;
  },
  _getElemIndex:function(parent,elem) {
    return Array.prototype.indexOf.call(parent.getElementsByTagName("*"), elem);
  },
  _getValue:function(variable,parent) {
    let v=this.variables[variable];
    if(!v) {
      throw new Error(
        "Variable " + variable + " doesn't exists"
      );
    }

    if(!parent || v.collectionIndex===undefined) {
      return v.value;
    } else {
      let e=parent.getElementsByTagName("*")[v.collectionIndex-1];
      if(e.value!==undefined) {
        return e.value;
      } else {
        return e.innerText;
      }
    }
  },
  assignCollection: function (collectionVar, collection) {
    let coll = this.collections[collectionVar];
    if (coll === undefined) {
      throw new Error(
        "Collection variable " + collectionVar + " doesn't exists"
      );
    }
    coll.element.innerHTML='';
    let collIndexVar=collectionVar+"/"+coll.indexVar;
    collection.forEach((r,index) => {
      let collVars={};
      if(this._isStructureObject(r)) {
        Object.keys(r).forEach(k=>{
          collVars[collIndexVar+"."+k]=r[k];
        })
      } else {
        collVars[collIndexVar]=r;
      }
      let inner = this._parseHtml(coll.template);
      inner.querySelectorAll('[data-var]').forEach(e=>{
        let v=e.getAttribute("data-var");
        let collV=this._getCollectionVar(v);
        if(collV!==null) {
          let s=this.assignCollection(collV.var,collVars[collV.var]);
          e.innerHTML=""; 
          while(s.children.length>0) { //copy all subchildren to the element
            e.append(s.firstElementChild); //the first child will be removed from s when append it to e
          }

        } else {
          this._updateElem(e,this._evalTemplate(v,collVars));

          let vars = v.match(/\$\{[^\}]*\}/g).map((m) => {
            let g = /\$\{ *([^ \}]*) *\}/.exec(m);
            return g[1];
          });
          vars.forEach(v2=>{
            if(this.variables[v2]?.value) {
              this.variables[v2].updateElems.add(e);
            }
          });
          let self = this;
          if (e.onchange !== undefined) {
            if (vars.length === 1) {
              e.addEventListener("change", (evt) => {
                self.assign(vars[0], evt.target.value,coll.element.children[index]);
              });
            }
          }

        }
        
        
      })
      
      coll.element.append(inner);

    });
    return coll.element;//.cloneNode(true);


  },

  
  _isStructureObject:function(obj) {
    return obj === Object(obj) && !Array.isArray(obj);
  },

  variables: [],
  collections: [],
  start:undefined
};

customElements.define('data-val',
  class extends HTMLElement {
    constructor() {
      super();

    }
  }
);



document.addEventListener("DOMContentLoaded", function (event) {
  DATA.init();
  DATA.start && DATA.start();
});
