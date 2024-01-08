import _fs from "fs";
import _http from "http";

const paginaErrore = new Promise<string>((resolve, reject) => {
    _fs.readFile("./static/error.html", (err : NodeJS.ErrnoException | null, data : Buffer) => {
        if (err) 
        {
            resolve(`<h1>Risorsa non trovata</h1>`);
        }
        else resolve(data.toString());
    });
});

type TipoServer  = _http.Server<typeof _http.IncomingMessage, typeof _http.ServerResponse> 

export { paginaErrore, TipoServer };