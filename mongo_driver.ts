import {Collection, MongoClient, ObjectId} from "mongodb";

/**
 * @description Driver per MongoDB
 * @class MongoDriver
 * @exports MongoDriver
 */
class MongoDriver{
    private constructor(strConn : string){
        this.strConn = strConn;
        this.Prompt(`Driver creato con stringa di connessione ${strConn}`)
    }
    /**
     * @description Crea un oggetto ID data una string
     * @param {string} id Stringa da convertire
     * @returns {ObjectId} Oggetto ObjectId corrispondente
     */
    public ID(id : string) : ObjectId{
        return new ObjectId(id)
    }

    /**
     * @description Crea un'istanza di MongoDriver
     * @param {string} strConn Stringa di connessione al DB
     * @param {string} nomeDatabase Nome del database
     * @param {string} collezione Nome della collezione
     * @throws {Error} Se la stringa di connessione non è valida
     * @throws {Error} Se il database non esiste
     * @throws {Error} Se la collezione non esiste
     */
    public static async CreaDatabase(strConn : string, nomeDatabase : string, collezione? : string) : Promise<MongoDriver> {
        const database = new MongoDriver(strConn);
        await database.SettaDatabase(nomeDatabase);
        if(collezione) await database.SettaCollezione(collezione);

        database.Prompt(`Database ${database.database} e collezione ${database.collezione} impostati`)
        return database;
    }

    private strConn : string;
    private database : string = "";
    private collezione : string = "";

    /**
     * @description Restituisce il nome della collezione corrente
     * @returns {string} Nome della collezione
     */
    get Collezione() : string { return this.collezione }

    /**
     * @description Imposta il nome della collezione corrente
     * @param {string} collezione Nome della collezione
     * @throws {Error} Se la collezione non esiste
     */
    public async SettaCollezione(collezione : string) {
        const client = await this.Client();
        const db = client.db(this.database);
        const collezioni = await db.listCollections().toArray();

        if(collezioni.some(c => c.name == collezione))
        {
            this.collezione = collezione;
        }
        else throw new Error(`La collezione ${collezione} non esiste`);
    }

    /**
     * @description Ritorna la lista delle collezioni nel database
     * @throws Ritorna un oggetto col campo "errore" contente il messaggio
     * @returns {Promise<{collezioni? : string[], errore? : string}>} Un array col nome delle collezioni
     */

    public async Collezioni() : Promise<{collezioni? : string[], errore? : string}> {
        try
        {
            const {client} = await this.Connetti();
            const db = client.db(this.database);
            const collezioni = await db.listCollections().toArray();

            client.close();

            return {"collezioni" : collezioni.map(c => c.name)};
        }
        catch(err){ return {"errore" : `${err}`} }
    }

    /**
     * @description Restituisce il nome del database corrente
     * @returns {string} Nome del database
     */
    get Database() : string { return this.database }

    /**
     * @description Imposta il nome del database corrente
     * @param {string} nomeDatabase Nome del database
     * @throws {Error} Se il database non esiste
     */
    public async SettaDatabase(nomeDatabase : string){
        const client = await this.Client();
        const dbList = await client.db().admin().listDatabases();

        if(dbList.databases.some(db => db.name == nomeDatabase))
        {
            this.database = nomeDatabase;
        }
        else throw new Error(`Il database ${nomeDatabase} non esiste`);
    } 

    /**
     * @description Restituisce la stringa di connessione corrente
     * @returns {string} Stringa di connessione
     */
    get StrConn() : string { return this.strConn }

    /**
     * @description Restituisce tutti i risultati della query
     * @param {object} query Query da eseguire
     * @param {object} projection Campi da proiettare
     * @param {object} sort Ordinamento -- {sort : nomeCampo, direction : "asc" | "desc"}
     * @throws {object} Restituisce un oggetto con la chiave "errore" e il messaggio di errore
     * @returns {Promise<object>} Risultato della query
     */
    public async PrendiMolti(query: object = {}, projection:object = {}, sort:{sort : any, direction? : number} = {sort: {}}) : Promise<object> {
        const {client, collection} = await this.Connetti();

        return this.EseguiQuery(async () => collection.find(query).project(projection).sort(Object.values(sort)).toArray(), client)
    }

    /**
     * @description Restituisce il primo risultato della query
     * @param {object} query Query da eseguire
     * @param {object} projection Campi da proiettare
     * @throws {object} Restituisce un oggetto con la chiave "errore" e il messaggio di errore
     * @returns {Promise<object>} Risultato della query
     */
    public async PrendiUno(query: object = {}, projection : object = {}) : Promise<object> {
        const {client, collection} = await this.Connetti();

        return this.EseguiQuery(async () => collection.findOne(query, { projection }), client)
    }

    /**
     * @description Restituisce la corrispondenza con l'ID specificato
     * @param {string} id ID del record
     * @throws {object} Restituisce un oggetto con la chiave "errore" e il messaggio di errore
     * @returns {Promise<object>} Risultato della query
     */
    public CercaID(id : string) : Promise<object>{
        return this.PrendiUno({"_id" : new ObjectId(id)});
    }

    /**
     * @description Restituisce la corrispondenza con l'ID specificato
     * @param {object[]} oggetti Record da inserire
     * @throws {object} Restituisce un oggetto con la chiave "errore" e il messaggio di errore
     * @returns {Promise<object>} Risultato della query
     */
    public async Inserisci(...oggetti: object[]) : Promise<object> {
        const {client, collection} = await this.Connetti();
        const rq = oggetti.length == 1 ? collection.insertOne(oggetti[0]) : collection.insertMany(oggetti);

        return this.EseguiQuery(() => rq, client);
    }

    /** 
     * @description Aggiorna il primo record che corrisponde al filtro
     * @param {object} filtro Filtro per la query
     * @param {object} update Aggiornamento da applicare
     * @param {boolean} upsert Se true, crea un nuovo record se non trova corrispondenze
     * @throws {object} Restituisce un oggetto con la chiave "errore" e il messaggio di errore
     * @returns {Promise<object>} Risultato della query
     */
    public async UpdateUno(filtro : object, update : object, upsert : boolean = false) : Promise<object> {
        const {client, collection} = await this.Connetti(); 

        return this.EseguiQuery(() => collection.updateOne(filtro, update, { upsert }), client);
    }

     /**
     * @description Aggiorna tutti i record che corrispondono al filtro
     * @param {object} filtro Filtro per la query
     * @param {object} update Aggiornamento da applicare
     * @param {boolean} upsert Se true, crea un nuovo record se non trova corrispondenze
     * @throws {object} Restituisce un oggetto con la chiave "errore" e il messaggio di errore
     * @returns {Promise<object>} Risultato della query
     */
    public async UpdateMolti(filtro : object, update : object, upsert : boolean = false) : Promise<object> {
        const {client, collection} = await this.Connetti(); 

        return this.EseguiQuery(() => collection.updateMany(filtro, update, { upsert }), client);
    }

    /**
     * @description Aggiorna tutti i record che corrispondono al filtro
     * @param {object} filtro Filtro per la query
     * @param {object} oggetto Oggetto che rimpiazza il record
     * @param {boolean} upsert Se true, crea un nuovo record se non trova corrispondenze
     * @throws {object} Restituisce un oggetto con la chiave "errore" e il messaggio di errore
     * @returns {Promise<object>} Risultato della query
     */
    public async SostituisciUno(filtro: object, oggetto: object, upsert: boolean = false) : Promise<object> {
        const {client, collection} = await this.Connetti(); 

        return this.EseguiQuery(() => collection.replaceOne(filtro, oggetto, { upsert }), client);
    }

    /**
     * @description Elimina il primo record che corrisponde al filtro
     * @param {object} query Filtro per la query
     * @throws {object} Restituisce un oggetto con la chiave "errore" e il messaggio di errore
     * @returns {Promise<object>} Risultato della query
     */
    public async EliminaUno(query : object) : Promise<object> {
        const {client, collection} = await this.Connetti(); 

        return this.EseguiQuery(() => collection.deleteOne(query), client);
    }

    /**
     * @description Elimina tutti i record che corrispondono al filtro
     * @param {object} query Filtro per la query
     * @throws {object} Restituisce un oggetto con la chiave "errore" e il messaggio di errore
     * @returns {Promise<object>} Risultato della query
     */
    public async Elimina(query : object) : Promise<object> {
        const {client, collection} = await this.Connetti(); 

        return this.EseguiQuery(() => collection.deleteMany(query), client);
    }

    /**
     * @description Restituisce il numero di record che corrispondono al filtro
     * @param {object} query Filtro per la query
     * @throws {object} Restituisce un oggetto con la chiave "errore" e il messaggio di errore
     * @returns {Promise<object>} Risultato della query
     */
    public async NumeroRecord(query : object = {}) : Promise<object> {
        const {client, collection} = await this.Connetti(); 

        return this.EseguiQuery(() => collection.countDocuments(query), client);
    }

    /**
     * @description Restituisce i valori distinti di un campo
     * @param {string} record Campo su cui applicare il distinct
     * @param {object} query Filtro per la query
     * @throws {object} Restituisce un oggetto con la chiave "errore" e il messaggio di errore
     * @returns {Promise<object>} Risultato della query
     */
    public async PrendiDistinct(record : string, query : object = {}) : Promise<object> {
        const {client, collection} = await this.Connetti(); 

        return this.EseguiQuery(() => collection.distinct(record, query), client);
    }

    /**
     * @description Sostuisce il primo record che corrisponde al filtro mantenendo l'ID
     * @param {object} query Filtro per la query
     * @param {string} nuovo Campo che rimpiazza il campo specificato in query
     * @param {boolean} upsert Se true, crea un nuovo record se non trova corrispondenze
     * @throws {object} Restituisce un oggetto con la chiave "errore" e il messaggio di errore
     * @returns {Promise<object>} Risultato della query
     */
    public async Replace(query : object, nuovo : object, upsert : boolean = false) : Promise<object> {
        const {client, collection} = await this.Connetti(); 

        return this.EseguiQuery(() => collection.replaceOne(query, nuovo, { upsert }), client);
    }
    
    private async EseguiQuery(funzione_query : Function, client : MongoClient) : Promise<object>{
        try
        {
            const data = await funzione_query();
            this.Prompt("Query eseguita con successo");
            return data;
        }
        catch(err)
        {
            this.Prompt(`Errore esecuzione query: ${err}`);
            return { "errore" : `${err}` };
        }
        finally { client.close() }
    }

    private async Connetti() : Promise<{client : MongoClient, collection : Collection}> {
        const client = await this.Client();
        const collection = client.db(this.database).collection(this.collezione);
        return {client, collection};
    }

    private async Client() : Promise<MongoClient>{
        const client = new MongoClient(this.strConn);
        await client.connect();
        return client;
    }

    private Prompt(...elementi : any[]) : void {
        console.log(">>> ", ...elementi);
    }
}

export default MongoDriver; 