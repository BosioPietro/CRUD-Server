import _http from "http";
import _cors, { CorsOptions } from "cors";
import _dotenv from "dotenv";
import MongoDriver from "./mongo_driver.js";
import _express, {Express, Request, Response, NextFunction} from "express";
import { paginaErrore, TipoServer } from "./strumenti.js";


const app : Express = _express();
_dotenv.config({"path" : ".env"})

// APERTURA SERVER
const DBNAME : string = process.env.DBNAME!;
const PORTA : number = parseInt(process.env.PORT!);
const [driver, errore] = await Promise.all([MongoDriver.CreaDatabase(process.env.STR_CONN!, DBNAME), paginaErrore]);
const server : TipoServer = _http.createServer(app);

server.listen(PORTA, () => console.log("Server Avviato"));

// MIDDLEWARE

/*  1. Logging Richieste  */
app.use("/", (req : Request, res : Response, next : NextFunction) => {
    console.log(`>--> ${req.method} ${req.originalUrl}`)
    next();
})

/*  2. Gestione Risorse Static  */
app.use("/", _express.static("./static"));

// 3. Lettura dei parametri POST di req["body"] (bodyParser)
app.use("/", _express.json({ "limit": "50mb" }));
app.use("/", _express.urlencoded({ "limit": "50mb", "extended": true }));

/*  4. Log dei paramatri, GET, POST, PUT, PATCH*/
app.use("/", (req : Request, res : Response, next : NextFunction) => {

    const Vuoto = (o : object) : boolean => !Object.keys(o).length;

    if(!Vuoto(req["query"]))
    {
        console.log(`    ${JSON.stringify(req["query"])}`)
    }
    else if(!Vuoto(req["body"]))
    {
        console.log(`    ${JSON.stringify(req["body"])}`)
    }
    next();
}) 

/*  5. CORS */
const corsOptions : CorsOptions = {
    origin: (origin : string | undefined, callback : Function) => callback(null, true),
    credentials: true
}

app.use("/", _cors(corsOptions));

// ROUTE FINALI

app.get("/api/collections", async (req : Request, res : Response) => {
    const collezioni : object = await driver.Collezioni();
    if("errore" in collezioni)
    {
        res.status(500).send(collezioni["errore"]);
    }
    else res.json(collezioni);
})

app.get("/api/:collezione", async (req : Request, res : Response) => {
    const { collezione } = req["params"];
    const filtri = JSON.parse(req["query"]["filtri"] as string || "{}");

    console.log(req["query"]["filtri"])

    await driver.SettaCollezione(collezione)
    const dati = await driver.PrendiMolti(filtri);
    
    if("errore" in dati)
    {
        res.status(500).send(dati["errore"]);
    }
    else res.status(200).json(dati);
});

app.get("/api/:collezione/:id", async (req : Request, res : Response, next : NextFunction) => {
    const { collezione, id } = req["params"];

    await driver.SettaCollezione(collezione);
    const oggetto = await driver.CercaID(id)

    if("errore" in oggetto)
    {
        res.status(500).send(oggetto["errore"]);
    }
    else res.send(oggetto)
});

app.post("/api/:collezione/", async (req : Request, res : Response, next : NextFunction) => {
    const record = req["body"];
    const { collezione } = req["params"];

    await driver.SettaCollezione(collezione);
    const data = await driver.Inserisci(record);

    if("errore" in data)
    {
        res.status(500).send(data["errore"]);
    }
    else res.send({"ok" : "Record Aggiunto"})
});

app.delete("/api/:collezione/:id", async (req : Request, res : Response, next : NextFunction) => {
    const { collezione, id } = req["params"];

    await driver.SettaCollezione(collezione);
    const data = await driver.EliminaUno({"_id" : driver.ID(id)})

    if("errore" in data)
    {
        res.status(500).send(data["errore"]);
    }
    else res.send({"ok" : "Record Eliminato"})
});

app.delete("/api/:collezione/", async (req : Request, res : Response, next : NextFunction) => {
    const { collezione } = req["params"];
    const filters = req["body"];

    await driver.SettaCollezione(collezione);
    const data = await driver.Elimina(filters)

    if("errore" in data)
    {
        res.status(500).send(data["errore"]);
    }
    else res.send({"ok" : "Record Eliminato"})
});


app.patch("/api/:collezione/:id", async (req : Request, res : Response, next : NextFunction) => {
    const { collezione, id } = req["params"];
    const record = req["body"];
    
    delete(record["_id"])

    await driver.SettaCollezione(collezione);
    const data = await driver.UpdateUno(
        {"_id" : driver.ID(id)},
        {"$set" : record}
    )

    if("errore" in data)
    {
        res.status(500).send(data["errore"]);
    }
    else res.send({"ok" : "Record Aggiornato"})
});

app.patch("/api/:collezione", async (req : Request, res : Response, next : NextFunction) => {
    const { collezione } = req["params"];
    const { filters, action } = req["body"];

    await driver.SettaCollezione(collezione);
    const data = await driver.UpdateUno(filters, action)

    if("errore" in data)
    {
        res.status(500).send(data["errore"]);
    }
    else res.send({"ok" : "Record Aggiornato"})
});

app.put("/api/:collezione/:id",  async (req : Request, res : Response, next : NextFunction) => {
    const { collezione, id } = req["params"];
    const record = req["body"];
    await driver.SettaCollezione(collezione);

    const data = await driver.SostituisciUno({"_id" : driver.ID(id)}, record);

    if("errore" in data)
    {
        res.status(500).send(data["errore"]);
    }
    else res.send({"ok" : "Record Aggiornato"})
});


/*  GESTIONE ERRORI  */
app.use("/", (req : Request, res : Response, next : NextFunction) => {
    res.status(404);
    if (req["originalUrl"].startsWith("/api/")) 
    {
        res.send(`Api non disponibile`);
    }
    else res.send(errore);
});

app.use("/", (err: Error, req : Request, res : Response, next : NextFunction) : void => {
    console.log("*** ERRORE SERVER ***", err.stack)
})