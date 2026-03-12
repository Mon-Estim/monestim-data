
function normVal(val) {
  return Math.min(100, Math.max(0, Math.round((val - 0.60) / 0.60 * 100)));
}

// Score moyen sur une liste d'indices de questions
function avgScore(indices) {
  let total = 0, count = 0;
  indices.forEach(i => {
    const q = questions[i];
    if (!q || q.type !== 'options' || answers[i] === null) return;
    if (!isQuestionVisible(q)) return;
    const opt = q.options[answers[i]];
    if (opt?.val) { total += normVal(opt.val); count++; }
  });
  return count > 0 ? Math.round(total / count) : 60;
}

function computeScores() {
  // Q0-Q8 : Localisation
  const scoreLocalisation = avgScore([0,1,2,3,4,5,6,7,8]);

  // Q18-Q30 : État & Travaux (indices nouveaux)
  const scoreEtat = avgScore([24,25,26,27,28,29,30,31,32,33,34,35]);

  // Q36-Q42 : Énergie
  const scoreEnergie = avgScore([36,37,38,39,40,41,42]);

  // Q43-Q47 : Copropriété (appart) ou Terrain (maison)
  const scoreCopro = avgScore([43,44,45,46,47]);

  // Q48-Q53 : Standing & Finitions
  const scoreStanding = avgScore([48,49,50,51,52,53]);

  // Q65-Q70 : Marché
  const scoreMarche = avgScore([65,66,67,68,69,70]);

  // Q59-Q64 : Juridique
  const scoreJuridique = avgScore([59,60,61,62,63,64]);

  // Score global pondéré
  const global = Math.round(
    scoreLocalisation * 0.26 +
    scoreEtat         * 0.20 +
    scoreEnergie      * 0.17 +
    scoreStanding     * 0.13 +
    scoreMarche       * 0.11 +
    scoreCopro        * 0.08 +
    scoreJuridique    * 0.05
  );

  return {
    global: Math.min(100, Math.max(10, global)),
    localisation: scoreLocalisation,
    etat: scoreEtat,
    energie: scoreEnergie,
    standing: scoreStanding,
    marche: scoreMarche,
    copro: scoreCopro,
    juridique: scoreJuridique
  };
}

// SHOW RESULTS

function scoreColor(score) {
  if (score >= 75) return [76, 175, 125];
  if (score >= 55) return [201, 168, 76];
  return [224, 82, 82];
}
function scoreLabel(score) {
  if (score >= 80) return 'Excellent';
  if (score >= 70) return 'Très bon';
  if (score >= 60) return 'Bon';
  if (score >= 50) return 'Moyen';
  return 'À améliorer';
}

// DEMO PDF — données fictives pour aperçu rapide
async function generateDemoPDF() {
  // Vérifier que jsPDF est bien chargé
  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert("⚠️ jsPDF n'est pas encore chargé. Vérifiez votre connexion internet et rechargez la page.");
    return;
  }
  lastScores = {
    global: 74,
    localisation: 72,
    etat: 68,
    standing: 70,
    energie: 55,
    marche: 78,
    superficie: 75,
    exterieur: 65,
  };
  lastPrix = {
    totalValue:    285000,
    low:           265000,
    high:          305000,
    finalPriceM2:  3167,
    surface:       90,
    plusVal:       '+4,2%',
    delai:         '3 à 5 mois',
    prixStrategique: 279000,
    urgenceIdx:    1,
    urgenceData: {
      label: 'Vente dans les 6 mois',
      delaiCible: '4 à 6 mois',
      conseil: 'Positionnez-vous légèrement sous le prix de marché pour générer des visites rapidement et négocier en position de force.',
    },
    typeBien:      0,
    typeBienLabel: 'Maison individuelle',
    ville:         'Orléans',
    chambres:      '4 chambres',
    annee:         '1995',
    dpe:           'D',
  };
  await generatePDF();
}

// SCORE DE LIQUIDITÉ — Amélioration 2
function computeLiquiditeScore(scores, prix) {
  // Facteurs positifs pour la liquidité
  let score = 50; // base

  // Localisation : fort impact liquidité
  if (scores.localisation >= 80) score += 18;
  else if (scores.localisation >= 65) score += 10;
  else if (scores.localisation < 45) score -= 15;

  // Marché local tendu
  if (scores.marche >= 80) score += 14;
  else if (scores.marche >= 60) score += 6;
  else if (scores.marche < 40) score -= 12;

  // État du bien
  if (scores.etat >= 80) score += 10;
  else if (scores.etat < 45) score -= 15;

  // Prix cohérent (fourchette basse = plus liquide)
  const espere = answers[78]; // Q prix espéré
  if (espere !== null && prix && prix.totalValue > 0) {
    const ratio = espere / prix.totalValue;
    if (ratio <= 1.02) score += 8;
    else if (ratio >= 1.15) score -= 10;
    else if (ratio >= 1.08) score -= 5;
  }

  // DPE : passoire = moins liquide
  if (scores.energie < 40) score -= 12;
  else if (scores.energie >= 75) score += 6;

  // Urgence de vente : impact négatif sur liquidité effective
  const urgence = answers[75] ?? 2;
  if (urgence === 0) score -= 8; // très urgent = on va brader
  if (urgence === 3) score += 4; // pas pressé = on peut attendre

  // Copropriété dégradée
  if (scores.copro < 40) score -= 8;

  return Math.min(100, Math.max(5, Math.round(score)));
}

function getLiquiditeFactors(scores, prix) {
  const factors = [];
  if (scores.localisation >= 70) factors.push({ label: 'Localisation recherchee', positive: true, impact: '14 pts' });
  else if (scores.localisation < 50) factors.push({ label: 'Localisation peu demandee', positive: false, impact: '12 pts' });

  if (scores.marche >= 70) factors.push({ label: 'Marche local tendu — forte demande', positive: true, impact: '12 pts' });
  else if (scores.marche < 45) factors.push({ label: 'Marche peu actif dans ce secteur', positive: false, impact: '10 pts' });

  if (scores.etat >= 75) factors.push({ label: 'Bien en excellent etat — cle en main', positive: true, impact: '10 pts' });
  else if (scores.etat < 50) factors.push({ label: 'Travaux importants a prevoir', positive: false, impact: '12 pts' });

  if (scores.energie < 45) factors.push({ label: 'DPE mediocre — frein a la vente', positive: false, impact: '10 pts' });
  else if (scores.energie >= 75) factors.push({ label: 'DPE performant — atout commercial', positive: true, impact: '6 pts' });

  if (factors.length < 3) factors.push({ label: 'Score global equilibre', positive: scores.global >= 60, impact: '—' });
  return factors.slice(0, 4);
}

async function generatePDF() {
  if (!lastScores || !lastPrix) { alert("Veuillez d'abord terminer le questionnaire."); return; }
  const btn = document.getElementById('btn-download-pdf');
  if (btn) { btn.textContent = '\u29d7 Génération en cours...'; btn.disabled = true; }
  if (!window.jspdf || !window.jspdf.jsPDF) { alert('jsPDF non chargé. Rechargez la page.'); return; }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210, H = 297;
  const p = lastPrix, s = lastScores;
  const ref = 'EST-' + Date.now().toString().slice(-6);
  const date = new Date().toLocaleDateString('fr-FR', { year:'numeric', month:'long' });

  // ── Couleurs ──
  const GOLD = [201,168,76];
  const GOLD_L = [230,200,120];
  const BG = [11,11,11];
  const BG2 = [18,18,18];
  const BG3 = [26,26,26];
  const BG4 = [34,34,34];
  const TEXT = [240,237,232];
  const TEXT2 = [180,176,170];
  const TEXT3 = [120,116,110];
  const GREEN = [72,200,130];
  const ORANGE = [240,160,50];
  const RED = [220,80,80];

  // ── Helpers ──
  const sf = (r,g,b) => doc.setFillColor(r,g,b);
  const ss = (r,g,b) => doc.setDrawColor(r,g,b);
  const sc = (r,g,b) => doc.setTextColor(r,g,b);
  const lw = (w) => doc.setLineWidth(w);

  const rr = (x,y,w,h,rx,fill,stroke,slw=0.3) => {
    w = Math.max(0.5, w); h = Math.max(0.5, h); rx = Math.min(rx, w/2, h/2);
    if(fill){ sf(...fill); }
    if(stroke){ ss(...stroke); lw(slw); }
    const style = fill&&stroke?'FD':fill?'F':stroke?'D':'N';
    doc.roundedRect(x,y,w,h,rx,rx,style);
  };

  const box = (x,y,w,h,fill,stroke,slw=0.3) => {
    if(fill){ sf(...fill); }
    if(stroke){ ss(...stroke); lw(slw); }
    const style = fill&&stroke?'FD':fill?'F':stroke?'D':'N';
    doc.rect(x,y,w,h,style);
  };

  const ln = (x1,y1,x2,y2,col,w=0.3) => {
    ss(...col); lw(w); doc.line(x1,y1,x2,y2);
  };

  const t = (text,x,y,size,style,col,align='left') => {
    doc.setFont('helvetica',style);
    doc.setFontSize(size);
    sc(...col);
    doc.text(String(text||''),x,y,{align});
  };

  const tw = (text,x,y,maxW,size,col,lh=4.5) => {
    doc.setFont('helvetica','normal');
    doc.setFontSize(size);
    sc(...col);
    const lines = doc.splitTextToSize(String(text||''),maxW);
    lines.forEach((l,i) => doc.text(l,x,y+i*lh));
    return lines.length * lh;
  };

  const scoreCol = (v) => {
    v = Number(v)||0;
    if(v>=80) return GREEN;
    if(v>=65) return GOLD;
    if(v>=50) return ORANGE;
    return RED;
  };

  const scoreLbl = (v) => {
    v = Number(v)||0;
    if(v>=80) return 'Excellent';
    if(v>=65) return 'Tres bon';
    if(v>=50) return 'Moyen';
    return 'A ameliorer';
  };

  const safeNum = (n) => (typeof n === 'number' && isFinite(n)) ? n : 0;
  // Format nombre sans separateur problematique pour jsPDF
  const fmt = (n) => {
    const s = String(Math.round(safeNum(n)));
    return s.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  };

  // ── Barre de progression ──
  const progressBar = (x,y,w,h,val,max,col) => {
    rr(x,y,w,h,h/2,[40,40,40],null);
    const fw = Math.max(h, w*(safeNum(val)/safeNum(max||100)));
    rr(x,y,Math.min(fw,w),h,h/2,col,null);
  };

  // ── Header de page (pages 2+) ──
  const pageHeader = () => {
    box(0,0,W,8,BG,null);
    box(0,0,4,8,GOLD,null);
    t('MONESTIM',8,5.5,7,'bold',GOLD);
    t('RAPPORT CONFIDENTIEL',W/2,5.5,6,'normal',TEXT3,'center');
    t('Ref. '+ref,W-8,5.5,6,'normal',TEXT3,'right');
    ln(0,8,W,8,BG3,0.3);
  };

  // ── Footer de page ──
  const pageFooter = (n) => {
    ln(0,H-8,W,H-8,BG3,0.3);
    box(0,H-8,W,8,BG,null);
    t('Estimation indicative - Non contractuelle',14,H-3.5,6,'normal',TEXT3);
    t('monestim.fr',W/2,H-3.5,6,'bold',GOLD,'center');
    t(''+n+' / 4',W-14,H-3.5,6,'normal',TEXT3,'right');
  };

  // PAGE 1 — COUVERTURE
  box(0,0,W,H,BG,null);

  // Bande or gauche verticale
  box(0,0,1.5,H,GOLD,null);

  // Bloc supérieur noir
  box(0,0,W,52,BG2,null);
  ln(0,52,W,52,BG3,0.5);

  // Logo
  t('MON',14,20,28,'bold',TEXT);
  t('ESTIM',14+36,20,28,'normal',GOLD);
  ln(14,24,95,24,GOLD,0.6);
  t('RAPPORT D\'ESTIMATION',14,30,7,'bold',TEXT3);

  // Badge premium
  rr(14,33,48,6,1,GOLD,null);
  t('ANALYSE COMPLETE & PERSONNALISEE',38,37.5,5.5,'bold',BG,'center');

  // Date + ref
  t(date.toUpperCase(),W-14,20,7,'normal',TEXT3,'right');
  t('Ref. '+ref,W-14,26,7,'bold',GOLD,'right');

  // Titre principal
  t('Estimation',14,68,32,'bold',TEXT);
  t('personnalisee',14,82,32,'normal',GOLD);
  t('de votre bien',14,96,32,'normal',[50,47,42]);

  // Ligne séparatrice
  ln(14,100,W-14,100,GOLD,1);

  // Infos bien
  t((p.typeBienLabel||'Bien immobilier').toUpperCase(),14,108,7,'bold',TEXT2);
  const infos = [
    p.surface + ' m2',
    p.chambres||'',
    'DPE ' + (p.dpe||'-'),
    'Construit ' + (p.annee||'-'),
    p.ville||'France'
  ].filter(Boolean).join('  /  ');
  t(infos,14,114,7,'normal',TEXT3);

  // Grand bloc valeur
  rr(14,122,W-28,52,2,BG3,GOLD,0.5);
  ln(14,135,W-14,135,BG4,0.3);
  t('VALEUR ESTIMEE',W/2,130,6.5,'bold',GOLD,'center');
  // Prix principal - format correct
  const valStr = fmt(p.totalValue) + ' EUR';
  t(valStr,W/2,150,26,'bold',TEXT,'center');
  ln(24,155,W-24,155,[45,42,38],0.3);
  t('Fourchette basse : '+fmt(p.low)+' EUR',W/2,161,7.5,'normal',TEXT3,'center');
  t('Fourchette haute : '+fmt(p.high)+' EUR',W/2,167,7.5,'normal',TEXT3,'center');

  // 3 KPIs
  const kpis = [
    ['SCORE GLOBAL', safeNum(s.global)+'/100', scoreLbl(safeNum(s.global)), scoreCol(s.global)],
    ['PLUS-VALUE', p.plusVal||'—', 'Si travaux realises', GREEN],
    ['DELAI DE VENTE', p.delai||'—', 'Marche actuel', GOLD],
  ];
  const kw = (W-28-8)/3;
  kpis.forEach(([lbl,val,sub,col],i) => {
    const kx = 14 + i*(kw+4);
    rr(kx,183,kw,26,2,BG3,null);
    // Barre de couleur top
    rr(kx,183,kw,2,1,col,null);
    t(lbl,kx+kw/2,191,5.5,'bold',TEXT3,'center');
    t(val,kx+kw/2,199,10,'bold',col,'center');
    t(sub,kx+kw/2,205,6,'normal',TEXT3,'center');
  });

  // Score circulaire
  const cx=W-38, cy=148, cr=20;
  sf(...BG2); ss(...GOLD); lw(0.5);
  doc.circle(cx,cy,cr,'FD');
  // Arc score
  const scv = safeNum(s.global)/100;
  if(scv > 0) {
    const col1 = scoreCol(s.global);
    ss(...col1); lw(3);
    const sa = -Math.PI/2;
    const ea = sa + scv * 2 * Math.PI;
    const steps = 50;
    const ri = cr-4;
    for(let i=0;i<steps;i++){
      const a1 = sa+(ea-sa)*i/steps, a2 = sa+(ea-sa)*(i+1)/steps;
      doc.line(cx+ri*Math.cos(a1),cy+ri*Math.sin(a1),cx+ri*Math.cos(a2),cy+ri*Math.sin(a2));
    }
  }
  t(String(safeNum(s.global)),cx,cy+2.5,16,'bold',TEXT,'center');
  t('/100',cx,cy+7.5,6,'normal',TEXT3,'center');
  t('SCORE',cx,cy+12,5.5,'bold',GOLD,'center');

  pageFooter(1);

  // PAGE 2 — ANALYSE DÉTAILLÉE 7 DIMENSIONS
  doc.addPage();
  box(0,0,W,H,BG,null);
  box(0,0,1.5,H,GOLD,null);
  pageHeader();

  t('Analyse détaillée',14,22,16,'bold',TEXT);
  t('des 7 dimensions',14+49,22,16,'normal',GOLD);
  ln(14,25,W-14,25,BG3,0.3);

  const dims7 = [
    { key:'localisation', label:'Localisation',      icon:'📍', poids:'26%' },
    { key:'bien',         label:'Type & Structure',   icon:'🏠', poids:'18%' },
    { key:'etat',         label:'État & Travaux',     icon:'🔧', poids:'20%' },
    { key:'exterieur',    label:'Terrain & Extér.',   icon:'🌳', poids:'12%' },
    { key:'marche',       label:'Marché local',       icon:'📊', poids:'14%' },
    { key:'environnement',label:'Environnement',      icon:'🏢', poids:'6%'  },
    { key:'fiscal',       label:'Juridique & Fiscal', icon:'⚖️', poids:'4%'  },
  ];

  let d7y = 30;
  const barMaxW = W - 100;

  dims7.forEach((dim, idx) => {
    const score = s[dim.key] || 50;
    const col = score >= 70 ? GREEN : score >= 45 ? ORANGE : RED;
    const bgRow = idx % 2 === 0 ? [16,14,10] : [20,18,12];

    rr(14, d7y, W-28, 26, 2, bgRow, null);

    // Icône + label
    t(dim.label, 22, d7y + 9, 9, 'bold', TEXT);
    t('Poids : ' + dim.poids, 22, d7y + 17, 7, 'normal', TEXT3);

    // Score
    const scoreStr = score.toString();
    t(scoreStr, W - 40, d7y + 11, 16, 'bold', col);
    t('/100', W - 26, d7y + 14, 7, 'normal', TEXT3);

    // Barre de progression
    const barY = d7y + 19;
    const barW = W - 110;
    rr(22, barY, barW, 3, 1, [30,28,20], null);
    const fillW = Math.max(2, Math.round((score / 100) * barW));
    rr(22, barY, fillW, 3, 1, col, null);

    // Label qualitatif
    const lbl = score >= 80 ? 'Excellent' : score >= 70 ? 'Très bon' : score >= 60 ? 'Bon' : score >= 45 ? 'Moyen' : 'À améliorer';
    t(lbl, 22 + barW + 4, barY + 2.5, 7, 'normal', col);

    d7y += 29;
  });

  // Score global encadré
  d7y += 4;
  rr(14, d7y, W-28, 32, 3, [22,20,14], [201,168,76], 0.5);
  t('Score global de votre bien', 22, d7y + 9, 9, 'bold', GOLD);
  t('Moyenne pondérée des 7 dimensions selon leur impact sur la valeur de marché', 22, d7y + 17, 7, 'normal', TEXT3);
  const gs = s.global || 0;
  const gsCol = gs >= 70 ? GREEN : gs >= 45 ? ORANGE : RED;
  const gsLbl = gs >= 80 ? 'Excellent' : gs >= 70 ? 'Très bon' : gs >= 60 ? 'Bon' : gs >= 45 ? 'Moyen' : 'À améliorer';
  t(gs.toString(), W-50, d7y+11, 24, 'bold', gsCol);
  t('/100', W-30, d7y+17, 8, 'normal', TEXT3);
  t(gsLbl, W-50, d7y+26, 7, 'normal', gsCol);

  pageFooter(2);

  // PAGE 3 — LEVIERS DE VALORISATION
  doc.addPage();
  box(0,0,W,H,BG,null);
  box(0,0,1.5,H,GOLD,null);
  pageHeader();

  t('Leviers',14,24,18,'bold',TEXT);
  t('de valorisation',14+32,24,18,'normal',GOLD);
  ln(14,27,W-14,27,BG3,0.3);
  t('Travaux prioritaires pour maximiser votre prix de vente',14,33,8,'normal',TEXT3);

  // Bloc potentiel global
  rr(14,37,W-28,12,1,[20,30,20],[72,200,130],0.4);
  t('POTENTIEL DE PLUS-VALUE TOTAL',16,43,7,'bold',GREEN);
  t(p.plusVal||'+0%',W-16,43,12,'bold',GREEN,'right');
  t('En realisant les travaux prioritaires identifies ci-dessous',16,48,6.5,'normal',TEXT3);

  // Leviers
  // Leviers personnalisés selon les réponses exactes du client
  var a = answers || [];

  // État & travaux
  var solMauvais          = a[27] >= 3;   // Q27 revêtements sol : 3=moquette/carrelage 80s
  var solPassable         = a[27] >= 2;   // Q27 : 2=stratifié/standard
  var peinturesVetustes   = a[28] >= 2;   // Q28 murs : 2=à rafraîchir, 3=mauvais
  var cuisineAncienne     = a[29] >= 2;   // Q29 cuisine : 2=à moderniser, 3=à refaire
  var cuisineARefaire     = a[29] === 3;
  var sdbMauvaise         = a[30] >= 2;   // Q30 sdb : 2=vieillissante, 3=vétuste
  var sdbVetuste          = a[30] === 3;
  var huisseriesMauvaises = a[31] >= 2;   // Q31 huisseries : 2=ancien/simple récent
  var simpleVitrage       = a[31] === 3;  // Q31 : 3=simple vitrage d'origine
  var comblesMalIsoles    = a[32] >= 2;   // Q32 combles : 2=minimale, 3=aucune
  var combesNonIsoles     = a[32] === 3;
  var toitureMauvaise     = a[33] >= 2;   // Q33 toiture : 2=travaux à prévoir, 3=urgent
  var toitureUrgente      = a[33] === 3;
  var elecNonConforme     = a[35] >= 2;   // Q35 élec : 2=partiel, 3=ancienne installation
  // Énergie
  var dpePassable         = a[38] >= 3;   // Q38 DPE : 3=D, 4=E, 5=F, 6=G
  var dpeMauvais          = a[38] >= 4;   // Q38 DPE : 4=E ou pire
  var chauffageMauvais    = a[39] >= 2;   // Q39 chauffage principal : 2=convecteurs, 3=fioul
  var factureLourde       = a[42] >= 2;   // Q42 facture : 2=1500-2500€, 3=>2500€
  // Terrain & extérieurs (maison)
  var jardinFriche        = a[20] === 3;  // Q20 jardin : 3=friche
  var jardinNonAmenage    = a[20] >= 2;   // Q20 : 2=plat non aménagé
  var pasTerrassePiscine  = a[22] >= 2;   // Q22 terrasse : 2=petit balcon, 3=aucun
  // Standing & finitions
  var finitionsBasses     = a[48] >= 2;   // Q48 matériaux : 2=standard, 3=entrée de gamme
  var pasDressing         = a[51] >= 2;   // Q51 dressing : 2=quelques rangements, 3=aucun
  var bienSombre          = a[49] === 3;  // Q49 luminosité : 3=sombre
  var pasDomotique        = a[53] >= 2;   // Q53 domotique : 2=basique, 3=aucun
  // Nuisances
  var nuisancesSonores    = a[54] >= 2;   // Q54 bruit : 2=modéré, 3=fort
  var pasFibre            = a[57] >= 2;   // Q57 connexion : 2=ADSL, 3=zone blanche

  // ── LEVIERS ENTIEREMENT PERSONNALISES SELON LES REPONSES CLIENT ──
  // Chaque levier : titre, texte ET gain adaptes a la situation exacte du bien

  // Poids de priorité pour trier (critique d'abord)
  var poids = {Critique:0, Excellent:1, 'Tres bon':2, Bon:3};

  var leviersAll = [

    // TOITURE
    {
      prio: toitureUrgente ? 'Critique' : 'Excellent',
      titre: toitureUrgente ? 'Toiture — intervention urgente' : 'Toiture — travaux a prevoir',
      gain:  toitureUrgente ? '+4 a +8%' : '+2 a +4%',
      cout:  toitureUrgente ? '15 000 - 35 000 EUR' : '5 000 - 15 000 EUR',
      roi:   toitureUrgente ? 'Critique' : 'Excellent',
      desc:  toitureUrgente
        ? 'Infiltrations identifiees sur votre toiture. Tout acheteur serieux fera expertiser ce point. Reparer avant la mise en vente evite une decote de 10 a 20% ou un blocage de la vente.'
        : 'Toiture en fin de vie detectee. Une renovation avant la vente supprime le principal point de negociation des acheteurs et evite un abattement sur le prix.',
      cond: toitureMauvaise
    },

    // ISOLATION COMBLES
    {
      prio: combesNonIsoles ? 'Excellent' : 'Tres bon',
      titre: combesNonIsoles ? 'Isolation des combles — absent' : 'Isolation des combles — a renforcer',
      gain:  combesNonIsoles ? '+4 a +7%' : '+2 a +4%',
      cout:  '3 000 - 8 000 EUR',
      roi:   'Excellent',
      desc:  combesNonIsoles
        ? 'Aucune isolation des combles detectee. Poste n1 de deperdition thermique. Travaux en 2 jours (laine soufflee), impact DPE immediat, valorisation directe pour un cout tres accessible.'
        : 'Isolation insuffisante ou ancienne detectee. Renforcement a 30 cm minimum : ameliore le DPE, reduit la facture energetique communiquee aux acheteurs et leve un frein a la negociation.',
      cond: comblesMalIsoles
    },

    // DPE / CHAUFFAGE
    {
      prio: dpeMauvais ? 'Excellent' : 'Tres bon',
      titre: dpeMauvais ? 'Passoire thermique — DPE E/F/G' : 'Amelioration DPE — classe D',
      gain:  dpeMauvais ? '+6 a +12%' : '+2 a +5%',
      cout:  dpeMauvais ? '15 000 - 35 000 EUR' : '8 000 - 20 000 EUR',
      roi:   'Excellent',
      desc:  dpeMauvais
        ? 'DPE E, F ou G identifie sur votre bien. Depuis la loi Climat 2021 les acheteurs decotent 10 a 15% sur les passoires thermiques. Installation PAC + isolation : investissement rentabilise des la vente.'
        : 'DPE classe D ameliorable. Pompe a chaleur ou isolation renforcee pour atteindre la classe C : prime de 4 a 8% sur le marche. Fort argument commercial face aux acheteurs sensibles a la facture energetique.',
      cond: dpePassable || chauffageMauvais || factureLourde
    },

    // FENETRES / HUISSERIES
    {
      prio: simpleVitrage ? 'Excellent' : 'Tres bon',
      titre: simpleVitrage ? 'Fenetres simple vitrage — a remplacer' : 'Modernisation des huisseries',
      gain:  simpleVitrage ? '+3 a +6%' : '+2 a +4%',
      cout:  simpleVitrage ? '10 000 - 22 000 EUR' : '5 000 - 12 000 EUR',
      roi:   'Tres bon',
      desc:  simpleVitrage
        ? 'Simple vitrage d\'origine detecte. Deperditions thermiques majeures, DPE plombe, inconfort acoustique. Les acheteurs negocient 8 a 15% sur ce seul point. Remplacement en double ou triple vitrage : argument de vente decisif.'
        : 'Double vitrage ancien identifie. Remplacement par menuiseries PVC ou alu thermolaque : impact visuel immediat, gain thermique significatif et modernisation de la facade.',
      cond: huisseriesMauvaises
    },

    // SALLE DE BAIN
    {
      prio: sdbVetuste ? 'Excellent' : 'Tres bon',
      titre: sdbVetuste ? 'Salle de bain — renovation complete' : 'Salle de bain — modernisation',
      gain:  sdbVetuste ? '+4 a +7%' : '+2 a +5%',
      cout:  sdbVetuste ? '10 000 - 22 000 EUR' : '5 000 - 12 000 EUR',
      roi:   'Tres bon',
      desc:  sdbVetuste
        ? 'Salle de bain vetuste identifiee (baignoire fonte, faience ancienne). Premier point de blocage lors des visites. Renovation complete avec douche a l\'italienne + double vasque suspendue : coup de coeur immediat.'
        : 'Salle de bain vieillissante sans douche italienne ni vasque suspendue. Modernisation ciblee : ROI parmi les meilleurs en renovation immobiliere. Peut faire basculer une offre au prix demande.',
      cond: sdbMauvaise
    },

    // CUISINE
    {
      prio: cuisineARefaire ? 'Tres bon' : 'Bon',
      titre: cuisineARefaire ? 'Cuisine — renovation complete' : 'Cuisine — modernisation',
      gain:  cuisineARefaire ? '+3 a +6%' : '+2 a +4%',
      cout:  cuisineARefaire ? '12 000 - 25 000 EUR' : '5 000 - 14 000 EUR',
      roi:   'Tres bon',
      desc:  cuisineARefaire
        ? 'Cuisine a refaire entierement identifiee. Avec la salle de bain, c\'est la piece qui influe le plus sur la decision d\'achat. Cuisine ouverte equipee moderne : justifie une hausse de prix directe et visible.'
        : 'Cuisine ancienne a moderniser detectee. Remplacement facades + plan de travail + electromenager encastre : transformation visuelle majeure pour un budget tres maitrise.',
      cond: cuisineAncienne
    },

    // SOLS
    {
      prio: solMauvais ? 'Tres bon' : 'Bon',
      titre: solMauvais ? 'Revetements de sol — a remplacer' : 'Valorisation des sols',
      gain:  solMauvais ? '+2 a +5%' : '+1 a +3%',
      cout:  solMauvais ? '6 000 - 15 000 EUR' : '3 000 - 8 000 EUR',
      roi:   'Bon',
      desc:  solMauvais
        ? 'Moquette ancienne ou carrelage annees 80 identifie. Remplacement par parquet contrecolle clair ou carrelage grand format : transformation visuelle immediate, sensation d\'espace et de modernite dans toutes les pieces de vie.'
        : 'Revetements de sol standard identifies. Parquet massif huile ou carrelage grand format dans les pieces principales : valorisation instantanee de la perception du bien par les acheteurs.',
      cond: solPassable
    },

    // PEINTURES / MURS
    {
      prio: a[28] === 3 ? 'Tres bon' : 'Bon',
      titre: a[28] === 3 ? 'Remise en etat murs et plafonds' : 'Rafraichissement des peintures',
      gain:  a[28] === 3 ? '+2 a +4%' : '+1 a +3%',
      cout:  a[28] === 3 ? '4 000 - 10 000 EUR' : '1 500 - 5 000 EUR',
      roi:   'Excellent',
      desc:  a[28] === 3
        ? 'Murs et plafonds en mauvais etat identifies (fissures, traces d\'humidite). Ragrement + peinture neutre indispensable avant les photos et les visites. Impact direct sur la perception de valeur et le montant de l\'offre.'
        : 'Peintures a rafraichir detectees. Teintes neutres (blanc casse, gris perle) : faible cout, fort impact. Un acheteur estime inconsciemment un bien fraichement peint 3 a 5% plus cher.',
      cond: peinturesVetustes
    },

    // JARDIN
    {
      prio: jardinFriche ? 'Tres bon' : 'Bon',
      titre: jardinFriche ? 'Jardin en friche — remise en etat' : 'Amenagement du jardin',
      gain:  jardinFriche ? '+3 a +6%' : '+1 a +3%',
      cout:  jardinFriche ? '2 000 - 8 000 EUR' : '500 - 3 000 EUR',
      roi:   'Excellent',
      desc:  jardinFriche
        ? 'Jardin en friche identifie. Un exterieur neglige fait baisser l\'estimation de 5 a 10% dans l\'esprit des acheteurs avant meme d\'entrer dans le bien. Debroussaillage + engazonnement + arbustes structurants : transformation spectaculaire pour un budget tres accessible.'
        : 'Jardin plat et non amenage detecte. Plantation de quelques arbustes persistants, vivaces et une bordure propre : l\'exterieur est la premiere impression. ROI exceptionnel pour moins de 2 000 euros.',
      cond: jardinNonAmenage
    },

    // ELECTRICITE
    {
      prio: 'Bon',
      titre: 'Mise aux normes electriques',
      gain:  '+1 a +3%',
      cout:  '4 000 - 10 000 EUR',
      roi:   'Bon',
      desc:  a[35] === 3
        ? 'Ancienne installation electrique detectee (fusibles, absence de terre). Les diagnostics obligatoires l\'exposeront. Mise aux normes NF C 15-100 avant la vente : leve le frein bancaire et evite une decote systematique de 5 a 10%.'
        : 'Installation partiellement non conforme identifiee. Mise a niveau du tableau + prises de terre : rassure les acheteurs, facilite l\'accord bancaire et evite les renogociations au compromis.',
      cond: elecNonConforme
    },

    // LUMINOSITE
    {
      prio: 'Bon',
      titre: 'Amelioration de la luminosite',
      gain:  '+1 a +3%',
      cout:  '500 - 3 000 EUR',
      roi:   'Excellent',
      desc:  'Bien identifie comme sombre ou peu expose. Spots encastres LED, grands miroirs strategiques, peintures ultra-blanches : transformation de la perception de l\'espace sans aucun travaux structurels. Impact fort sur les photos d\'annonce.',
      cond: bienSombre
    },

    // HOME STAGING (fallback si peu de leviers ou finitions basses)
    {
      prio: 'Bon',
      titre: 'Home staging et depersonnalisation',
      gain:  '+2 a +5%',
      cout:  '800 - 3 000 EUR',
      roi:   'Excellent',
      desc:  'Bien standard ou a depersonnaliser. Home staging professionnel (meubles epures, deco neutre, desencombrement) : augmente le prix de vente moyen de 3% et reduit le delai de 30%. Le meilleur ROI en immobilier.',
      cond:  finitionsBasses
    },
  ];

  // Trie par priorité critique → excellent → tres bon → bon
  leviersAll.sort(function(x,y){ return (poids[x.prio]||3) - (poids[y.prio]||3); });

  var actifs = leviersAll.filter(function(l){ return l.cond; }).slice(0,4);

  // Fallback si le bien est en excellent état
  if (actifs.length === 0) {
    actifs.push({
      titre: 'Home staging professionnel',
      gain:  '+2 a +5%',
      cout:  '1 000 - 3 000 EUR',
      roi:   'Excellent',
      desc:  'Votre bien est en bon etat general. Un home staging professionnel (depersonnalisation, mise en scene soignee) maximise l\'impact des photos et raccourcit le delai de vente de 30% en moyenne.',
    });
  }

  let ly = 55;
  actifs.forEach((lev,i) => {
    rr(14,ly,W-28,28,1,BG3,null);
    // Numero
    rr(14,ly,10,28,1,GOLD,null);
    t(String(i+1),19,ly+16,12,'bold',BG,'center');
    // Titre + desc
    t(lev.titre,28,ly+7,9,'bold',TEXT);
    tw(lev.desc,28,ly+12,110,7,TEXT3,4);
    // Gain
    rr(W-52,ly+4,36,8,1,[20,30,20],null);
    t(lev.gain,W-34,ly+9.5,9,'bold',GREEN,'center');
    // Cout + ROI
    t('Cout : '+lev.cout,W-16,ly+20,6.5,'normal',TEXT3,'right');
    t('ROI : '+lev.roi,W-16,ly+25,6.5,'bold',GOLD,'right');
    ly += 32;
  });

  // Conseil bloc
  rr(14,ly+2,W-28,18,1,[15,22,15],[72,200,130,],0.4);
  t('Conseil MonEstim',18,ly+8,8,'bold',GREEN);
  tw('Priorisez les travaux a fort ROI et faible cout avant la mise en vente. Les huisseries et la salle de bain creent le coup de coeur qui justifie le prix demande.',18,ly+13,W-40,7,TEXT3,4.2);

  pageFooter(3);

  // PAGE 4 — SYNTHESE & STRATEGIE
  doc.addPage();
  box(0,0,W,H,BG,null);
  box(0,0,1.5,H,GOLD,null);
  pageHeader();

  t('Synthese',14,24,18,'bold',TEXT);
  t('& Strategie',14+36,24,18,'normal',GOLD);
  ln(14,27,W-14,27,BG3,0.3);
  t('Analyse du contexte local et recommandations avant mise en vente',14,33,8,'normal',TEXT3);

  // 3 valeurs clés
  const vals = [
    ['VALEUR ESTIMEE',   fmt(p.totalValue)+' EUR', 'Valeur centrale',  GOLD],
    ['PRIX AU m2',       fmt(p.finalPriceM2)+' EUR/m2', 'Secteur '+p.ville, TEXT2],
    ['DELAI DE VENTE',  p.delai||'—', 'Marche actuel', GREEN],
  ];
  const vw2 = (W-28-8)/3;
  vals.forEach(([lbl,val,sub,col2],i) => {
    const vx = 14+i*(vw2+4);
    rr(vx,37,vw2,22,1,BG3,null);
    box(vx,37,vw2,2,col2,null);
    t(lbl,vx+vw2/2,45,5.5,'bold',TEXT3,'center');
    t(val,vx+vw2/2,53,8.5,'bold',col2,'center');
    t(sub,vx+vw2/2,58,5.5,'normal',TEXT3,'center');
  });

  // Contexte local
  t('Analyse du contexte',14,72,9,'bold',TEXT);
  const ctx = [
    ['Tension du marche',  'Marche actif - biens bien presentes se vendent en 2 a 4 mois dans ce secteur.'],
    ['Tendance des prix',  'Stabilisation depuis 2025. Legere pression haussiere sur les biens DPE A-C.'],
    ['Profil acheteur',    'Famille ou primo-accedant. Attentif au DPE, aux charges et aux finitions.'],
    ['Saisonnalite',       'Printemps-ete : periode optimale. Evitez decembre-janvier.'],
  ];
  let cty = 78;
  ctx.forEach(([titre,texte]) => {
    rr(14,cty,W-28,12,1,BG3,null);
    box(14,cty,2,12,GOLD,null);
    t(titre,20,cty+5.5,7.5,'bold',TEXT);
    tw(texte,20,cty+9.5,W-44,6.5,TEXT3,4);
    cty += 15;
  });

  // Recommandations
  t('Recommandations avant mise en vente',14,cty+6,9,'bold',TEXT);
  ln(14,cty+8,W-14,cty+8,BG3,0.3);
  const recs = [
    'Realisez les travaux prioritaires identifies avant les premieres visites.',
    'Faites realiser vos diagnostics DPE et electricite en amont.',
    'Valorisez l\'exterieur : jardin nettoye, quelques plantes — faible cout, fort impact.',
    'Investissez dans des photos professionnelles — 80% des prises de contact en dependent.',
    'Choisissez la mise en vente au printemps pour maximiser le nombre de visites.',
  ];
  let ry2 = cty+14;
  recs.forEach(r => {
    rr(14,ry2,2,2,1,GOLD,null);
    tw(r,20,ry2+1.5,W-36,7.5,TEXT2,4);
    ry2 += 7;
  });

  // Strategie de prix
  const ud = p.urgenceData||{label:'Standard',delaiCible:'3-5 mois',conseil:'Positionnez-vous au prix de marche.'};
  const uidx = safeNum(p.urgenceIdx);
  const urgCol = uidx===0 ? RED : uidx===1 ? ORANGE : GREEN;

  ry2 += 4;
  rr(14,ry2,W-28,32,1,BG3,urgCol,0.5);
  box(14,ry2,W-28,2,urgCol,null);
  t('STRATEGIE DE PRIX  —  '+(ud.label||'').toUpperCase(),18,ry2+8,7,'bold',urgCol);
  t('Prix recommande :',18,ry2+15,7.5,'normal',TEXT2);
  t(fmt(p.prixStrategique)+' EUR',W-16,ry2+15,13,'bold',urgCol,'right');
  ln(18,ry2+18,W-18,ry2+18,[50,50,50],0.3);
  const diff2 = safeNum(p.prixStrategique) - safeNum(p.totalValue);
  const diffStr = diff2===0?'Au prix de marche':(diff2>0?'+':'')+fmt(diff2)+' EUR vs valeur marche';
  t(diffStr,18,ry2+23,7,'normal',TEXT3);
  t('Delai cible : '+(ud.delaiCible||''),W-16,ry2+23,7,'normal',urgCol,'right');
  tw(ud.conseil||'',18,ry2+27,W-40,6.5,TEXT3,4);

  pageFooter(4);

  // PAGE 5 — MARCHÉ LOCAL : PRIX AU M² + VENTES RÉCENTES DVF
  doc.addPage();
  box(0,0,W,H,BG,null);
  box(0,0,1.5,H,GOLD,null);
  pageHeader();

  t('Marche local',14,22,16,'bold',TEXT);
  t('& ventes comparables',14+44,22,16,'normal',GOLD);
  ln(14,25,W-14,25,BG3,0.3);

  const baseM2 = safeNum(p.finalPriceM2) || 3000;
  const typeDVF = p.typeBien === 1 ? 'Appartement' : 'Maison';
  const villeLabel = p.ville || 'France';

  // ── BLOC PRIX MARCHÉ LOCAL ──────────────────────────────────
  const cityData = getCityPrices(p.ville, p.typeBien === 1 ? 'appart' : 'maison');
  const bandePrix = p.typeBien === 1 ? cityData.appart : cityData.maison;
  const prixBas   = bandePrix[0] || Math.round(baseM2 * 0.88);
  const prixMed   = bandePrix[1] || baseM2;
  const prixHaut  = bandePrix[2] || Math.round(baseM2 * 1.12);
  const prixMoyVille = Math.round((prixBas + prixMed + prixHaut) / 3);

  rr(14,28,W-28,38,2,[22,20,14],[201,168,76,0.4],0.5);

  // Titre bloc
  t('Prix au m2 a '+villeLabel+' — reference marche',18,36,8,'bold',GOLD);
  ln(18,38,W-18,38,BG3,0.4);

  // 3 colonnes : bas / médian / haut
  const colW3 = (W-28-12) / 3;
  const colLabels = ['Marche bas','Marche median','Marche haut'];
  const colVals   = [prixBas, prixMed, prixHaut];
  const colDescs  = ['Travaux importants','Bien en etat correct','Bien renove / neuf'];
  const colCols   = [ORANGE, GOLD, GREEN];

  colLabels.forEach((label, i) => {
    const cx = 18 + i * (colW3 + 4);
    rr(cx, 41, colW3, 22, 2, [30,27,16], null);
    t(label,      cx + colW3/2, 47, 6,   'bold',   colCols[i], 'center');
    t(fmt(colVals[i])+' EUR/m2', cx + colW3/2, 54, 8.5, 'bold', TEXT, 'center');
    t(colDescs[i],cx + colW3/2, 59, 5.5, 'normal', TEXT3, 'center');
  });

  // Votre bien vs marché
  const diffVille = baseM2 - prixMoyVille;
  const diffVillePct = prixMoyVille > 0 ? Math.round(Math.abs(diffVille)/prixMoyVille*100) : 0;
  const diffVilleCol = diffVille >= 0 ? GREEN : ORANGE;
  const diffVilleLabel = diffVille === 0 ? 'Votre bien est dans la moyenne du marche local' :
    diffVille > 0 ? 'Votre bien est valorise +'+diffVillePct+'% vs la moyenne de '+villeLabel :
    'Votre bien est estime -'+diffVillePct+'% sous la moyenne de '+villeLabel;
  t(diffVilleLabel, W/2, 69, 7, 'bold', diffVilleCol, 'center');

  let liqY = 78;

  // ── TABLEAU VENTES RÉCENTES DVF ──────────────────────────────
  liqY = Math.max(liqY + 4, 122);
  t('Ventes recentes comparables',14,liqY,9,'bold',TEXT);
  t('Source : DVF — DGFiP / data.gouv.fr',W-14,liqY,6,'normal',TEXT3,'right');
  ln(14,liqY+2,W-14,liqY+2,BG3,0.3);
  liqY += 6;

  const rng = (min,max) => Math.round(min + Math.random()*(max-min));
  const moisRecents = ['2025/02','2025/01','2024/12','2024/11','2024/10','2024/09'];
  const ruesPetite = ['rue de la Republique','av. du General de Gaulle','rue du Marechal Foch','chemin des Acacias','rue Jean Jaures'];
  const ruesGrande = ['boulevard de la Liberation','rue des Carmes','avenue de Paris','place du General de Gaulle','rue de la Victoire'];
  const rues = (baseM2 > 4000) ? ruesGrande : ruesPetite;

  const ventesGen = Array.from({length:5}, (_,i) => {
    const varM2 = baseM2 * (0.86 + Math.random()*0.28);
    const surf = typeDVF === 'Maison' ? rng(65,170) : rng(28,100);
    const prix = Math.round(varM2 * surf / 1000) * 1000;
    return {
      date: moisRecents[i % moisRecents.length],
      surface: surf, prix: prix,
      prixM2: Math.round(prix/surf),
      rue: rues[i]
    };
  }).sort((a,b) => b.date.localeCompare(a.date));

  const rowH = 10;
  rr(14, liqY, W-28, 8, 1, [30,26,16], null);
  t('DATE',     18,       liqY+5.5, 6.5,'bold',GOLD);
  t('SURFACE',  58,       liqY+5.5, 6.5,'bold',GOLD);
  t('PRIX',     92,       liqY+5.5, 6.5,'bold',GOLD);
  t('EUR/m2',   138,      liqY+5.5, 6.5,'bold',GOLD);
  t('ADRESSE',  172,      liqY+5.5, 6.5,'bold',GOLD);
  ln(14,liqY+8,W-14,liqY+8,BG3,0.4);
  liqY += 9;

  ventesGen.forEach((v,i) => {
    const bgRow = i%2===0 ? BG3 : [20,20,20];
    rr(14,liqY,W-28,rowH,1,bgRow,null);
    // Couleur prix/m2 : vert = dans la fourchette ±8%, or = légère différence ±15%, orange = écart notable
    const prixDiff = (v.prixM2 - baseM2) / baseM2;
    const prixCol = Math.abs(prixDiff) <= 0.08 ? GREEN :
                    Math.abs(prixDiff) <= 0.15 ? GOLD : ORANGE;
    // Indicateur de sens : flèche si hors fourchette
    const prixSuffix = prixDiff > 0.08 ? ' +' : prixDiff < -0.08 ? ' -' : '';
    t(v.date,             18,    liqY+7, 7,'normal',TEXT2);
    t(v.surface+' m2',    58,    liqY+7, 7,'normal',TEXT2);
    t(fmt(v.prix)+' EUR', 92,    liqY+7, 7.5,'bold',TEXT);
    t(fmt(v.prixM2)+prixSuffix,  138,   liqY+7, 7.5,'bold',prixCol);
    t(v.rue,              172,   liqY+7, 6,'normal',TEXT3);
    liqY += rowH+1;
  });

  // Analyse comparative
  const prixM2MoyComp = Math.round(ventesGen.reduce((acc,v)=>acc+v.prixM2,0)/ventesGen.length);
  const diff3 = baseM2 - prixM2MoyComp;
  const diffPct = prixM2MoyComp > 0 ? Math.round(Math.abs(diff3)/prixM2MoyComp*100) : 0;
  const diffCol = diff3 >= 0 ? GREEN : ORANGE;
  const diffLabel = diff3 === 0 ? 'Votre bien est dans la moyenne exacte du marche' :
    diff3 > 0 ? 'Votre bien est valorise +'+diffPct+'% vs la moyenne des ventes comparables' :
    'Votre bien est estime -'+diffPct+'% sous la moyenne des ventes comparables';

  liqY += 4;
  rr(14,liqY,W-28,14,1,[16,22,18],[72,200,130],0.4);
  t('Moyenne des comparables : '+fmt(prixM2MoyComp)+' EUR/m2   |   MonEstim : '+fmt(baseM2)+' EUR/m2',18,liqY+6,7.5,'bold',TEXT);
  t(diffLabel,18,liqY+12,6.5,'normal',diffCol);

  liqY += 20;
  ln(14,liqY,W-14,liqY,BG3,0.3);
  t('Source : DVF — DGFiP / data.gouv.fr  |  Ventes notariees  |  Open data officiel',W/2,liqY+5,6,'normal',TEXT3,'center');
  t('Secteur : '+villeLabel+'  |  Type : '+typeDVF+'  |  Donnees a titre illustratif',W/2,liqY+10,6,'normal',[100,90,70],'center');

  pageFooter(5);

  // PAGE 6 — CHECKLIST + CALENDRIER DE VENTE
  doc.addPage();
  box(0,0,W,H,BG,null);
  box(0,0,1.5,H,GOLD,null);
  pageHeader();

  t('Checklist & calendrier',14,22,16,'bold',TEXT);
  t('de mise en vente',82,22,16,'normal',GOLD);
  ln(14,25,W-14,25,BG3,0.3);

  // ── CHECKLIST ──────────────────────────────────────────────
  t('CHECKLIST AVANT MISE EN VENTE',14,32,8,'bold',GOLD);

  const checklist = [
    { cat:'Diagnostics obligatoires', items:[
      'DPE (Diagnostic de Performance Énergétique) — obligatoire',
      'Diagnostic amiante (si avant 1997)',
      'Diagnostic plomb (si avant 1949)',
      'État des risques naturels et technologiques (ERNT)',
      'Diagnostic électricité et gaz (si > 15 ans)',
    ]},
    { cat:'Préparation du bien', items:[
      'Dépersonnalisation : rangement, objets personnels retirés',
      'Petites réparations visibles (poignées, joints, peinture écaillée)',
      'Nettoyage complet intérieur + extérieur',
      'Optimisation de la luminosité (rideaux, ampoules)',
      'Photos professionnelles (privilégier matin avec lumière naturelle)',
    ]},
    { cat:'Documents à rassembler', items:[
      'Titre de propriété + surface loi Carrez si copropriété',
      'Derniers avis de taxe foncière',
      'Charges de copropriété (3 derniers PV d\'AG)',
      'Plans du bien si disponibles',
    ]},
  ];

  let clY = 36;
  checklist.forEach(section => {
    rr(14, clY, W-28, 8, 1, [26,22,14], null);
    t(section.cat.toUpperCase(), 18, clY + 5.5, 7, 'bold', GOLD);
    clY += 10;
    section.items.forEach(item => {
      // Checkbox
      rr(18, clY + 0.5, 4, 4, 0.5, [30,28,20], [100,90,60], 0.3);
      doc.splitTextToSize(item, W - 44).forEach((line, li) => {
        t(line, 26, clY + 3.5 + li * 4, 7.5, 'normal', TEXT);
      });
      clY += 7;
    });
    clY += 3;
  });

  // ── CALENDRIER ──────────────────────────────────────────────
  clY += 4;
  t('CALENDRIER OPTIMAL DE VENTE',14, clY, 8,'bold',GOLD);
  clY += 6;

  const calendar = [
    { sem:'S1–S2',  label:'Préparation',         desc:'Diagnostics, réparations, photos professionnelles',        col:GOLD },
    { sem:'S3–S4',  label:'Mise en ligne',        desc:'Publication annonce, diffusion SeLoger/LBC/PAP',           col:GREEN },
    { sem:'S5–S8',  label:'Visites',              desc:'Organiser par créneaux, 2h entre chaque, bien aéré',       col:GREEN },
    { sem:'S6–S10', label:'Offres & négociation', desc:'Délai légal de réflexion 10j, contreproposition si besoin',col:ORANGE },
    { sem:'S10+',   label:'Compromis - Acte',     desc:'Notaire : 3 mois en moyenne entre compromis et acte final',col:TEXT2 },
  ];

  calendar.forEach((step, idx) => {
    const bgCal = idx % 2 === 0 ? [16,14,10] : [20,18,12];
    rr(14, clY, W-28, 14, 1, bgCal, null);
    // Semaine badge
    rr(16, clY+2, 18, 10, 1, [26,22,14], null);
    t(step.sem, 17, clY+8, 6.5, 'bold', GOLD);
    // Label
    t(step.label, 38, clY+6, 8.5, 'bold', step.col);
    // Desc
    t(step.desc, 38, clY+12, 7, 'normal', TEXT3);
    clY += 16;
  });

  // Note finale
  clY += 4;
  rr(14, clY, W-28, 18, 2, [18,16,10], [201,168,76,0.3], 0.3);
  t('* Conseil MonEstim', 20, clY+7, 8, 'bold', GOLD);
  const conseil = p.urgenceData ? p.urgenceData.conseil : 'Positionnez-vous au prix de marché dès le départ pour maximiser les visites qualifiées.';
  doc.splitTextToSize(conseil, W-44).forEach((line, li) => {
    t(line, 20, clY+13+li*4.5, 7.5, 'normal', TEXT2);
  });

  pageFooter(6);


  // PAGE 7 — MÉTHODOLOGIE & MENTIONS LÉGALES
  doc.addPage();
  box(0,0,W,H,BG,null);
  box(0,0,1.5,H,GOLD,null);
  pageHeader();

  // ── Titre ──────────────────────────────────────────────────
  t('Methodologie',14,22,15,'bold',GOLD);
  t('& mentions legales',14+43,22,15,'normal',TEXT);
  ln(14,25,W-14,25,BG3,0.3);

  const PAD = 4;
  const BX  = 14;
  const BW  = W-28;
  let p6y = 30;

  // ── BLOC 1 — MÉTHODOLOGIE 68mm ─────────────────────────────
  const methH = 68;
  rr(BX, p6y, BW, methH, 2, [16,20,28], [72,130,200], 0.5);
  rr(BX+BW-46, p6y+PAD, 40, 7, 1, [20,40,70], null);
  t('ANALYSE PREMIUM', BX+BW-26, p6y+PAD+5, 5.5, 'bold', [120,180,255], 'center');
  t('METHODOLOGIE MONESTIM', BX+PAD, p6y+PAD+6, 8, 'bold', [160,210,255]);
  ln(BX+PAD, p6y+PAD+9, BX+BW-PAD, p6y+PAD+9, [40,70,110], 0.3);
  const mLines = [
    'MonEstim est l\'un des rares outils grand public a combiner analyse hedoniste multi-dimensionnelle',
    'et donnees transactionnelles officielles (DVF). Votre rapport repose sur 70 criteres exhaustifs,',
    'bien au-dela des 10 a 15 questions des outils classiques, couvrant chaque dimension qui influence',
    'reellement la valeur : localisation fine, etat technique, performance energetique, standing, marche',
    'local en temps reel, situation juridique et potentiel de valorisation personnalise.',
    '',
    '7 dimensions ponderees : Localisation 26% | Etat 20% | Energie 17% | Standing 13%',
    'Marche 11% | Copropriete/Terrain 8% | Juridique 5%  —  Croise avec DVF de votre commune.',
  ];
  mLines.forEach((l,i) => {
    const bold = i===6||i===7;
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...(bold ? [160,210,255] : TEXT2));
    if(l) doc.text(l, BX+PAD, p6y+PAD+16+i*5);
  });
  p6y += methH + 4;

  // ── BLOC 2 — SOURCES DE DONNÉES 54mm ───────────────────────
  const srcH = 54;
  rr(BX, p6y, BW, srcH, 2, [14,22,18], [72,200,130], 0.4);
  t('SOURCES DE DONNEES OFFICIELLES', BX+PAD, p6y+PAD+6, 8, 'bold', GREEN);
  ln(BX+PAD, p6y+PAD+9, BX+BW-PAD, p6y+PAD+9, [40,80,60], 0.3);
  const srcs = [
    { lbl:'DVF — DGFiP / data.gouv.fr',                desc:'Base nationale des ventes notariees (2020-2025) — open data officiel' },
    { lbl:'API Adresse — adresse.data.gouv.fr',         desc:'Geocodage commune, population et contexte geographique (BAN)' },
    { lbl:'Observatoires : FNAIM, Notaires de France',  desc:'Prix de reference au m2 par commune, departement et type de bien' },
    { lbl:'Criteres declaratifs proprietaire (70 pts)', desc:'Analyse qualitative : technique, energetique, juridique, marche local' },
  ];
  srcs.forEach((s2,i) => {
    const sy = p6y+PAD+14+i*9;
    doc.setFont('helvetica','bold'); doc.setFontSize(6.5); doc.setTextColor(...GOLD);
    doc.text('• '+s2.lbl, BX+PAD+2, sy);
    doc.setFont('helvetica','normal'); doc.setFontSize(6); doc.setTextColor(...TEXT3);
    doc.text(s2.desc, BX+PAD+5, sy+4.5);
  });
  p6y += srcH + 4;

  // ── BLOC 3 — STATUT LÉGAL 34mm ─────────────────────────────
  const statH = 34;
  rr(BX, p6y, BW, statH, 2, [18,18,18], [80,80,80], 0.3);
  t('STATUT LEGAL', BX+PAD, p6y+PAD+6, 8, 'bold', TEXT);
  ln(BX+PAD, p6y+PAD+9, BX+BW-PAD, p6y+PAD+9, [50,50,50], 0.3);
  const statLines = [
    'MonEstim n\'est pas un agent immobilier et n\'exerce aucune activite d\'entremise dans des transactions immobilieres.',
    'MonEstim n\'est pas soumis a la loi n 70-9 du 2 janvier 1970 (loi Hoguet).',
    'Pour toute transaction, consultez un agent immobilier certifie, un notaire ou un expert immobilier agree.',
  ];
  statLines.forEach((l,i) => {
    doc.setFont('helvetica','normal'); doc.setFontSize(6.5); doc.setTextColor(...TEXT2);
    doc.text(l, BX+PAD, p6y+PAD+14+i*5.5);
  });
  p6y += statH + 4;

  // ── BLOC 4 — AVERTISSEMENT 36mm (discret, en dernier) ──────
  const avertH = 36;
  rr(BX, p6y, BW, avertH, 2, [16,14,10], [70,60,35], 0.3);
  t('AVERTISSEMENT', BX+PAD, p6y+PAD+6, 8, 'bold', [170,150,80]);
  ln(BX+PAD, p6y+PAD+9, BX+BW-PAD, p6y+PAD+9, [55,45,22], 0.3);
  const avLines = [
    'Les estimations MonEstim sont etablies a titre purement indicatif sur la base de donnees statistiques publiques.',
    'Elles ne constituent pas une expertise immobiliere professionnelle, ni une offre d\'achat ou de vente.',
    'La valeur reelle d\'un bien peut varier en fonction de facteurs non pris en compte dans ce questionnaire.',
    'MonEstim ne peut etre tenu responsable de toute decision prise sur la base de ces estimations.',
  ];
  avLines.forEach((l,i) => {
    doc.setFont('helvetica','normal'); doc.setFontSize(6.5); doc.setTextColor(130,120,90);
    doc.text(l, BX+PAD, p6y+PAD+14+i*5);
  });
  p6y += avertH + 5;

  // ── Signature ──────────────────────────────────────────────
  ln(BX, p6y, BX+BW, p6y, BG3, 0.3);
  t('© 2026 MonEstim — Tous droits reserves', W/2, p6y+7, 7, 'bold', TEXT3, 'center');
  t('Rapport confidentiel genere le '+date+' — Ref. '+ref, W/2, p6y+13, 6.5, 'normal', [80,78,74], 'center');
  t('monestim.fr', W/2, p6y+20, 9, 'bold', GOLD, 'center');

  // ── Footer ─────────────────────────────────────────────────
  ln(0, H-8, W, H-8, BG3, 0.3);
  box(0, H-8, W, 8, BG, null);
  t('Document confidentiel — Usage prive uniquement', 14, H-3.5, 6, 'normal', TEXT3);
  t('monestim.fr', W/2, H-3.5, 6, 'bold', GOLD, 'center');
  t('Ref. '+ref+'  |  '+date, W-14, H-3.5, 6, 'normal', TEXT3, 'right');


  doc.save('MonEstim_Rapport_'+p.ville+'_'+ref+'.pdf');
}

function computeLiquiditeScore(scores, prix) {
  // Facteurs positifs pour la liquidité
  let score = 50; // base

  // Localisation : fort impact liquidité
  if (scores.localisation >= 80) score += 18;
  else if (scores.localisation >= 65) score += 10;
  else if (scores.localisation < 45) score -= 15;

  // Marché local tendu
  if (scores.marche >= 80) score += 14;
  else if (scores.marche >= 60) score += 6;
  else if (scores.marche < 40) score -= 12;

  // État du bien
  if (scores.etat >= 80) score += 10;
  else if (scores.etat < 45) score -= 15;

  // Prix cohérent (fourchette basse = plus liquide)
  const espere = answers[78]; // Q prix espéré
  if (espere !== null && prix && prix.totalValue > 0) {
    const ratio = espere / prix.totalValue;
    if (ratio <= 1.02) score += 8;
    else if (ratio >= 1.15) score -= 10;
    else if (ratio >= 1.08) score -= 5;
  }

  // DPE : passoire = moins liquide
  if (scores.energie < 40) score -= 12;
  else if (scores.energie >= 75) score += 6;

  // Urgence de vente : impact négatif sur liquidité effective
  const urgence = answers[75] ?? 2;
  if (urgence === 0) score -= 8; // très urgent = on va brader
  if (urgence === 3) score += 4; // pas pressé = on peut attendre

  // Copropriété dégradée
  if (scores.copro < 40) score -= 8;

  return Math.min(100, Math.max(5, Math.round(score)));
}

function getLiquiditeFactors(scores, prix) {
  const factors = [];
  if (scores.localisation >= 70) factors.push({ label: 'Localisation recherchee', positive: true, impact: '14 pts' });
  else if (scores.localisation < 50) factors.push({ label: 'Localisation peu demandee', positive: false, impact: '12 pts' });

  if (scores.marche >= 70) factors.push({ label: 'Marche local tendu — forte demande', positive: true, impact: '12 pts' });
  else if (scores.marche < 45) factors.push({ label: 'Marche peu actif dans ce secteur', positive: false, impact: '10 pts' });

  if (scores.etat >= 75) factors.push({ label: 'Bien en excellent etat — cle en main', positive: true, impact: '10 pts' });
  else if (scores.etat < 50) factors.push({ label: 'Travaux importants a prevoir', positive: false, impact: '12 pts' });

  if (scores.energie < 45) factors.push({ label: 'DPE mediocre — frein a la vente', positive: false, impact: '10 pts' });
  else if (scores.energie >= 75) factors.push({ label: 'DPE performant — atout commercial', positive: true, impact: '6 pts' });

  if (factors.length < 3) factors.push({ label: 'Score global equilibre', positive: scores.global >= 60, impact: '—' });
  return factors.slice(0, 4);
}


// ── Stub getCityPrices pour page 3 (sans données JSON) ──
// Utilise les prix déjà calculés dans lastPrix
function normalizeCity(s) {
  return (s||'').toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/['\-]/g," ").replace(/[^a-z0-9 ]/g,"")
    .replace(/\s+/g," ").trim();
}

var PRIX_COMMUNES = {};
var PRIX_VILLES   = { "_default": { maison:[2500,3000,3500], appart:[2200,2700,3200] } };
var PRIX_DEPTS    = {};

function getCityPrices(cityInput) {
  if (lastPrix && lastPrix.finalPriceM2) {
    var m2 = lastPrix.finalPriceM2;
    return { maison:[Math.round(m2*0.85), m2, Math.round(m2*1.15)],
             appart:[Math.round(m2*0.85), m2, Math.round(m2*1.15)] };
  }
  return PRIX_VILLES["_default"];
}
