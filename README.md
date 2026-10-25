# Tavusaari – MVP-prototyyppi

Suomen lukemaan oppimisen peli iPadille. Toteutettu verkkosovelluksena (PWA), jonka voi lisätä
iPadin kotivalikkoon. Suunnitelma: [SUUNNITTELU.md](SUUNNITTELU.md).

Ei build-vaihetta: pelkkää HTML:ää, CSS:ää ja JavaScript-moduuleja.

## Mitä prototyypissä on (vaihe 1)

- **Kirjaimet a i u o e s l m.** Ensimmäinen saari avaa a, i ja u. Seuraava kirjain avautuu, kun
  uusimmissa kirjaimissa on 10 oikeaa ensiyritystä ja kirjain on piirretty itse mallin vierestä.
- **Kuuntele ja löydä:** peli sanoo tavun, ja lapsi napauttaa oikean pallon.
- **Sano oikein:** ruudulla on tavu tai sana, eläimet sanovat vaihtoehtoja, ja lapsi valitsee oikein
  sanoneen. Jos mikrofoni on sallittu, lopuksi "Sano sinä!": lapsen ääni nauhoitetaan ja soitetaan
  mallin rinnalla.
- **Tavupaja:** kirjainvaunut vedetään junaan, ja veturi lausuu ne venyttäen ("ssss… aaaa… sa!").
- **Piirrä kirjain:** katso → jäljitä leveää → jäljitä ohutta → piirrä itse (→ muistista).
  Vetojen suunta ja järjestys tarkistetaan. Toimii sormella ja Apple Pencilillä.
- **Mukautuva vaikeus:** mitä paremmin lapsi osaa kohteen, sitä samankaltaisempia vaihtoehdot ovat.
  Lapsen omat sekaannukset kirjataan.
- **Tarrakirja** palkintona.
- **Aikuisten osio** (⚙️ ja kertolasku): edistyminen, sekoittuvat parit, asetukset ja äänitystyökalu.

## Äänet

Ääni tulee kahdesta lähteestä:

1. **Omat äänitykset** (suositus). Aikuisten osio → Äänitykset. Siellä on 131 ääntä: äänteet,
   venytetyt äänteet, tavut, sanat ja ohjeet. Äänitykset tallentuvat vain laitteelle.
2. **Puhesynteesi** niille äänille, joita ei ole äänitetty. iPadilla suomenkielinen ääni pitää
   ehkä ladata: *Asetukset → Käyttöapu → Puhuttu sisältö → Äänet → Suomi*.

Puhesynteesi lausuu yksittäiset äänteet (esim. "sss") huonosti, joten ainakin **äänteet** ja
**venytetyt äänteet** kannattaa äänittää itse heti alkuun.

## Käynnistys kehityskoneella

```bash
python -m http.server 8080
```

Avaa selaimessa http://localhost:8080.

## Testaus iPadilla

**Nopea kokeilu samassa verkossa:** käynnistä palvelin yllä olevalla komennolla ja avaa iPadin
Safarissa `http://<tietokoneen-IP>:8080`. Tietokoneen IP-osoitteen näet komennolla `ipconfig`.
Tällä tavalla peli toimii, mutta **äänitys, mikrofoni ja offline-tila eivät toimi**, koska ne
vaativat HTTPS-yhteyden.

**Varsinainen käyttö (HTTPS):** julkaise kansio esimerkiksi GitHub Pagesiin tai Netlifyyn. Avaa
osoite iPadin Safarissa ja valitse *Jaa → Lisää Koti-valikkoon*. Peli aukeaa silloin koko ruudulle
ja toimii ilman verkkoyhteyttä.

Huomio: äänitykset ja edistyminen tallentuvat osoitekohtaisesti. Äänitä siis vasta siinä
osoitteessa, jota aiot käyttää pysyvästi.

Kun julkaiset muutoksia, nosta `VERSION`-arvoa tiedostossa `sw.js`. Muuten iPad voi näyttää
välimuistissa olevan vanhan version.

## Rakenne

| Tiedosto | Sisältö |
|---|---|
| `js/content.js` | Kirjaimet, tavut, sanat, ohjeet ja harhautusvaihtoehtojen generointi |
| `js/progress.js` | Edistyminen, pisteytys, kohteiden valinta ja kirjainten avaaminen |
| `js/audio.js` | Äänitykset (Web Audio), puhesynteesi, äänitehosteet ja mikrofoni |
| `js/db.js` | Äänitysten tallennus (IndexedDB) |
| `js/round.js` | Kierroksen kulku (tehtävät → palkinto) |
| `js/modes/*.js` | Pelimoodit |
| `js/letterPaths.js` | Kirjainten vedot ja vedon tarkistus |
| `js/parent.js` | Aikuisten osio |
| `sw.js` | Offline-välimuisti |

## Tunnetut rajoitukset ja seuraavat askeleet

- Kirjainten vetojärjestykset on tarkistettava Opetushallituksen kirjainmalleista.
- Piirtäminen harjoittelee vain isoja kirjaimia.
- Yksi lapsiprofiili.
- Äänityksiä ei voi vielä viedä toiselle laitteelle eikä varmuuskopioida.
- Vaihe 2: kaikki kirjaimet, Sanapaja, Lue ja valitse, Pitkä vai lyhyt.
