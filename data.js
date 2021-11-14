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
          this._handleDataVar(data,elem);
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
        data.replace(env.var,env.fqn)
      );
      return data.replace(env.var,env.fqn);
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
    for(let c of elem.children) {
      this._findDataVariables(c,env);
    }
    this.collections[collectionVar] = {
      indexVar: indexVar,
      template: elem.innerHTML,
      element:elem
    };
    for(let c of elem.children) {
      c.remove();
    }

  },

  _handleDataVar:function(data,elem) {
    console.log("_handleDataVar",data,elem);
    let vars = data.match(/\$\{[^\}]*\}/g).map((m) => {
      let g = /\$\{ *([^ \}]*) *\}/.exec(m);
      return g[1];
    });
    vars.forEach((v) => {
      if (this.variables[v] === undefined) {
        this.variables[v] = { updateElems: new Set() };
      }
      this.variables[v].updateElems.add(elem);
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
    this._updateElem(elem, this._evalTemplate(data));


  },
  assign: function (variable, value) {
    let v = this.variables[variable];
    if (v) {
      v.value = value;
      v.updateElems.forEach((u) => {
        value = this._evalTemplate(u.getAttribute("data-var"),u["extraVars"]);
        this._updateElem(u, value);
      });
    } else {
      this.variables[variable] = { updateElems: new Set(), value: value };
    }
  },
  getValue: function (v) {
    return this.variables[v].value;
  },
  _updateElem: function (el, val) {
    if (el.value !== undefined) {
      el.value = val;
    } else {
      el.innerText = val;
    }
  },
  _evalTemplate: function (template,extraValues) {
    let vars = template.match(/\$\{[^\}]*\}/g).map((e) => {
      return /\$\{ *([^ \}]*) *\}/.exec(e)[1];
    });
    let value = template;
    vars.forEach((v) => {
      let re = new RegExp("\\$\\{ *" + v + " *\\}");
      let newVal=this.variables[v].value;
      if(newVal===undefined && extraValues) {
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
  assignCollection: function (collectionVar, collection) {
    let coll = this.collections[collectionVar];
    if (coll === undefined) {
      throw new Error(
        "Collection variable " + collectionVar + " doesn't exists"
      );
    }
    coll.element.innerHTML='';
    let collIndexVar=collectionVar+"/"+coll.indexVar;
    collection.forEach((r) => {
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
          e["extraVars"]=collVars;

          let vars = v.match(/\$\{[^\}]*\}/g).map((m) => {
            let g = /\$\{ *([^ \}]*) *\}/.exec(m);
            return g[1];
          });
          vars.forEach(v2=>{
            if(this.variables[v2]?.value) {
              this.variables[v2].updateElems.add(e);
            }
          })

        }
        
        
      })
      
      coll.element.append(inner);

    });
    return coll.element;//.cloneNode(true);


  },

  assignCollection_old: function (collectionVar, collection) {
    let coll = this.collections[collectionVar];
    if (coll === undefined) {
      throw new Error(
        "Collection variable " + collectionVar + " doesn't exists"
      );
    }
    coll.element.innerHTML='';
    let collIndexVar=collectionVar+"/"+coll.indexVar;
    
    collection.forEach((r) => {
      let collVars=[];
      if(this._isStructureObject(r)) {
        Object.keys(r).forEach(k=>{
          collVars.push({var:collIndexVar+"."+k,val:r[k]})
        })
      } else {
        collVars.push({var:collIndexVar,val:r});
      }


      collVars.forEach(v=>{
        if (this.collections[v.var]) {
          coll.element.append(this.assignCollection(v.var, v.val));
        } else {
          let inner = this._parseHtml(coll.template);
          inner
            .querySelectorAll("[data-var='${" + v.var + "}']")
            .forEach((e) => {
              this._updateElem(e, v.val);
            });
          coll.element.append(inner);
        }
      });
  

      })
    return coll.element.cloneNode(true);
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
