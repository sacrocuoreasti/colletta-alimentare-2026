export function SiteHeader() {
  return <header className="header">
    <a href="/" aria-label="Iscrizioni Colletta Alimentare, pagina iniziale"><img className="brand-logo" src="/banco-alimentare.svg" alt="Banco Alimentare" width="200" height="50" /></a>
    <nav className="header-links" aria-label="Navigazione"><a href="/">Iscriviti</a><a className="outline-button" href="/accesso">Carica autorizzazione</a></nav>
  </header>;
}
export function SiteFooter() { return <footer><span>Organizzazione interna dei volontari</span><a href="https://www.bancoalimentare.it/colletta-alimentare" target="_blank" rel="noreferrer">La Colletta Alimentare ↗</a></footer>; }
