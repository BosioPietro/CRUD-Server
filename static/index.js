let collezioneCorrente = null;

window.onload = () => {
    $("#cont-filtri").hide()
    $("#btnAdd").on("click", MostraAggiungi)
    $("#btnFind").on("click", ApplicaFiltri)
    CaricaCollezioni();
}

async function CaricaCollezioni(){
    const cont = $("#divCollections").empty()
    const collezioni = await InviaRichiesta("GET", "/api/collections").catch(Errore)

    if(!collezioni) return;

    for(const coll of collezioni["collezioni"]){
        const l = $("<label>").appendTo(cont)
        $("<input type='radio'>").appendTo(l).val(coll)
        .prop({name : "optCollections",})
        .on("click", (e) => RecordCollezione(e.target.value))
        $("<span>").text(coll).appendTo(l)
    }
}

async function RecordCollezione(collezione, filtri = {}){
    const record = await InviaRichiesta("GET", `/api/${collezione}`, filtri).catch(Errore)
    const tab = $("#mainTable tbody").empty()
    const campiInfo = $("#divIntestazione").find("strong")

    collezioneCorrente = collezione;

    $("#cont-filtri")[collezione == 'unicorns' ? 'show' : 'hide']()

    campiInfo.eq(0).text(collezione)
    campiInfo.eq(1).text(record.length)

    for(const r of record){
        const tr = $("<tr>").appendTo(tab).on("click", (e) => {
            if($(e.target).hasClass("controllo"))return;
            DettagliRecord(collezione, r["_id"])
        })
        $("<td>").text(r["_id"]).appendTo(tr)
        $("<td>").text(r["name"]).appendTo(tr)
        $("<td>").append([
            $("<div>").addClass("controllo").prop({title:"Update"}).on("click", () => MostraAggiorna(collezione, r, "PATCH")),
            $("<div>").addClass("controllo").prop({title:"Replace"}).on("click", () => MostraAggiorna(collezione, r, "PUT")), 
            $("<div>").addClass("controllo").prop({title:"Elimina"}).on("click", () => EliminaRecord(collezione, r["_id"]))
        ]).appendTo(tr)
    }
}

async function DettagliRecord(collezione, id){
    const dettagli = await InviaRichiesta("GET", `/api/${collezione}/${id}`).catch(Errore)
    const cont = $("#divDettagli").empty();

    if(!dettagli) return;

    for(const [chiave, val] of Object.entries(dettagli))
    {
        cont.append(`<span><b>${chiave}</b>:${val}</span>`)
    }
}

async function MostraAggiungi(){
    const cont = $("#divDettagli").empty();

    if(!collezioneCorrente) return alert("Seleziona una collezione")

    $("<textarea>").appendTo(cont)
    $("<button>").addClass("btn btn-success btn-sm")
    .text("Invia").appendTo(cont)
    .on("click", AggiungiRecord)
}

async function AggiungiRecord(){
    const txt = $("#divDettagli textarea").val()
    let json;

    if(!(json = ControllaJSON(txt))) return;
    if("_id" in json) return alert("Il JSON non può contenere il campo _id");

    const data = await InviaRichiesta("POST", `/api/${collezioneCorrente}`, json).catch(Errore)
    alert(data["ok"])

    RecordCollezione(collezioneCorrente);
}

function ControllaJSON(txt){
    try{ return JSON.parse(txt)}
    catch{ return alert("JSON non valido") }
}

async function EliminaRecord(collezione, id){
    if(!confirm("Vuoi davvero eliminare il record?"))return;

    const ris = await InviaRichiesta("DELETE", `/api/${collezione}/${id}`).catch(Errore)
    alert(ris["ok"])

    RecordCollezione(collezione);
}

function MostraAggiorna(collezione, record, metodo){
    record = JSON.parse(JSON.stringify(record))

    const cont = $("#divDettagli").empty();
    const txt = $("<textarea>").appendTo(cont)
    const id = record["_id"]

    delete record["_id"];
    txt.val(JSON.stringify(record, null, 3));

    $("<button>").addClass("btn btn-success btn-sm")
    .text("Invia").appendTo(cont)
    .on("click", () => AggiornaRecord(id, collezione, txt.val(), metodo))
}

async function AggiornaRecord(id, collezione, txt, metodo){
    if(!(json = ControllaJSON(txt))) return;

    if("_id" in json) return alert("Il JSON non può contenere il campo _id");
    const ris = await InviaRichiesta(metodo, `/api/${collezione}/${id}`, json).catch(Errore)
    alert(ris["ok"])

    RecordCollezione(collezione);
}

function ottieniFiltri(){
    const hair = $("#lstHair").val().toLowerCase()
    const input = $("#cont-filtri input[type=checkbox]:checked")

    const gender = input.toArray().reduce((prev, curr) => {
        prev["$in"].push(curr.value.substring(0,1).toLowerCase())
        return prev;
    }, {"$in" : []})

    return { hair, gender }

}

async function ApplicaFiltri(){
    const filtri = ottieniFiltri()
    RecordCollezione(collezioneCorrente, { filtri : JSON.stringify(filtri)})
}