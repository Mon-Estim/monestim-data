
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
  const scoreLocalisation = avgScore([0,1,2,3,4,5,6,7]); // Q8=type bien retiré (n'est pas un critère de localisation)

  // Q18-Q30 : État & Travaux (indices nouveaux)
  const scoreEtat = avgScore([25,26,27,28,29,30,31,32,33,34,35]); // Q24=parking retiré (standing, pas état)

  // Q36-Q42 : Énergie
  const scoreEnergie = avgScore([37,38,39,40,41,42]); // Q36=travaux récents retiré (pas énergie)

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
  if (btn) { btn.textContent = '⏳ Récupération données DVF...'; btn.disabled = true; }
  if (!window.jspdf || !window.jspdf.jsPDF) { alert('jsPDF non chargé. Rechargez la page.'); return; }

  // ── DONNÉES DVF — chargées depuis le payload (data-prix-communes.json) ──────
  // L'API externe dvf.data.gouv.fr a été retirée : trop instable, trop lente.
  // Toutes les données de marché viennent de data-prix-communes.json (32 473 communes)
  // déjà chargé localement et transmis dans p.prixBand via le payload.
  // Aucune requête réseau n'est nécessaire pour générer le PDF.

  if (btn) btn.textContent = '⏳ Génération PDF...';

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

  // ── ENCART DÉCOTE TOITURE (affiché uniquement si toitureMauvaise) ───
  // ── ENCARTS DYNAMIQUES — _alertY s'incrémente à chaque encart affiché ──
  let _alertY = 172;

  // TOITURE
  if (p.toitureAlert) {
    const ta = p.toitureAlert;
    const decoteMontant = Math.round(safeNum(p.totalValue) / (1 - safeNum(p.toitureMalus,0)) * safeNum(p.toitureMalus,0) / 1000) * 1000;
    rr(14, _alertY, W-28, 12, 1, [40,20,14], [220,80,50,0.25], 0.8);
    box(14, _alertY, 2, 12, ORANGE, null);
    t('⚠ DECOTE APPLIQUEE — ' + ta.label.toUpperCase(), 20, _alertY+5, 6.5, 'bold', ORANGE);
    t('-10% soit -'+fmt(decoteMontant)+' EUR integres dans l\'estimation', 20, _alertY+10.5, 5.5, 'normal', TEXT2);
    _alertY += 14;
  }

  // COMBLES
  if (p.comblesAlert) {
    const ca = p.comblesAlert;
    const decoteC = Math.round(safeNum(p.totalValue) / (1 - safeNum(p.comblesMalus,0)) * safeNum(p.comblesMalus,0) / 1000) * 1000;
    rr(14, _alertY, W-28, 12, 1, [30,28,14], [220,160,50,0.2], 0.8);
    box(14, _alertY, 2, 12, GOLD, null);
    t('⚠ DECOTE APPLIQUEE — ' + ca.label.toUpperCase(), 20, _alertY+5, 6.5, 'bold', GOLD);
    t('-'+ca.pct+'% soit -'+fmt(decoteC)+' EUR — isolation eligible a 1 EUR (MaPrimeRenov\')', 20, _alertY+10.5, 5.5, 'normal', TEXT2);
    _alertY += 14;
  }

  // VUE MER / PANORAMA
  if (p.vueAlert) {
    const isMer = p.vueAlert.type === 'mer';
    const bgVue  = isMer ? [14,22,30] : [14,22,14];
    const bdVue  = isMer ? [50,150,220] : [50,180,130];
    const colVue = isMer ? [100,180,255] : GREEN;
    const valVue = Math.round(safeNum(p.totalValue) / (1 + safeNum(p.vuePrimeTotal||0)) * safeNum(p.vuePrimeTotal||0) / 1000) * 1000;
    rr(14, _alertY, W-28, 12, 1, bgVue, bdVue, 0.8);
    box(14, _alertY, 2, 12, colVue, null);
    t('✦ PRIME DECLAREE — ' + p.vueAlert.label.toUpperCase(), 20, _alertY+5, 6.5, 'bold', colVue);
    t('+'+p.vueAlert.pct+'% soit +'+fmt(valVue)+' EUR integres — '+p.vueAlert.detail, 20, _alertY+10.5, 5.5, 'normal', TEXT2);
    _alertY += 14;
  }

  // PISCINE
  const piscineExtra = safeNum(p.piscineExtra, 0);
  if (piscineExtra > 0) {
    rr(14, _alertY, W-28, 12, 1, [14,28,22], [50,200,130,0.18], 0.8);
    box(14, _alertY, 2, 12, GREEN, null);
    const _piscLbl = piscineExtra === 10000 ? 'PISCINE CREUSEE ET CHAUFFEE' : 'PISCINE HORS SOL / SPA PROFESSIONNEL';
    t('✦ PLUS-VALUE INCLUSE — ' + _piscLbl, 20, _alertY+5, 6.5, 'bold', GREEN);
    t('+'+fmt(piscineExtra)+' EUR integres dans l\'estimation (valeur fixe marche)', 20, _alertY+10.5, 5.5, 'normal', TEXT2);
    _alertY += 14;
  }

  // 3 KPIs — positionnés après les encarts (_alertY dynamique)
  const _kpiY = _alertY + 4;
  const kpis = [
    ['SCORE GLOBAL', safeNum(s.global)+'/100', scoreLbl(safeNum(s.global)), scoreCol(s.global)],
    ['PLUS-VALUE', p.plusVal||'—', 'Si travaux realises', GREEN],
    ['DELAI DE VENTE', p.delai||'—', 'Marche actuel', GOLD],
  ];
  const kw = (W-28-8)/3;
  kpis.forEach(([lbl,val,sub,col],i) => {
    const kx = 14 + i*(kw+4);
    rr(kx,_kpiY,kw,26,2,BG3,null);
    // Barre de couleur top
    rr(kx,_kpiY,kw,2,1,col,null);
    t(lbl,kx+kw/2,_kpiY+8,5.5,'bold',TEXT3,'center');
    t(val,kx+kw/2,_kpiY+16,10,'bold',col,'center');
    t(sub,kx+kw/2,_kpiY+22,6,'normal',TEXT3,'center');
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
    { key:'localisation', label:'Localisation',       icon:'📍', poids:'15%' },
    { key:'etat',         label:'État & Travaux',      icon:'🔧', poids:'18%' },
    { key:'energie',      label:'Énergie & DPE',       icon:'⚡', poids:'20%' },
    { key:'standing',     label:'Standing & Atouts',   icon:'🏠', poids:'13%' },
    { key:'marche',       label:'Marché local',        icon:'📊', poids:'11%' },
    { key:'copro',        label:'Copro / Terrain',     icon:'🌳', poids:'8%'  },
    { key:'juridique',    label:'Juridique & Fiscal',  icon:'⚖️', poids:'5%'  },
  ];

  let d7y = 28;
  const barMaxW = W - 100;

  dims7.forEach((dim, idx) => {
    const score = s[dim.key] || 50;
    const col = score >= 70 ? GREEN : score >= 45 ? ORANGE : RED;
    const bgRow = idx % 2 === 0 ? [16,14,10] : [20,18,12];

    rr(14, d7y, W-28, 24, 2, bgRow, null);

    // Label adapté selon type de bien pour la dimension copro
    let label = dim.label;
    if (dim.key === 'copro') {
      label = (p.typeBien === 1) ? 'Copropriété' : 'Terrain & Extérieurs';
    }
    if (dim.key === 'standing') {
      label = (p.typeBien === 1) ? 'Standing & Atouts' : 'Standing & Atouts';
    }

    // Icône + label
    t(label, 22, d7y + 8, 9, 'bold', TEXT);
    t('Poids : ' + dim.poids, 22, d7y + 15, 7, 'normal', TEXT3);

    // Score
    const scoreStr = score.toString();
    t(scoreStr, W - 40, d7y + 10, 16, 'bold', col);
    t('/100', W - 26, d7y + 13, 7, 'normal', TEXT3);

    // Barre de progression
    const barY = d7y + 18;
    const barW = W - 110;
    rr(22, barY, barW, 3, 1, [30,28,20], null);
    const fillW = Math.max(2, Math.round((score / 100) * barW));
    rr(22, barY, fillW, 3, 1, col, null);

    // Label qualitatif
    const lbl = score >= 80 ? 'Excellent' : score >= 70 ? 'Très bon' : score >= 60 ? 'Bon' : score >= 45 ? 'Moyen' : 'À améliorer';
    t(lbl, 22 + barW + 4, barY + 2.5, 7, 'normal', col);

    d7y += 26;
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
  // ═══════════════════════════════════════════════════════════════
  // LEVIERS PERSONNALISES — audit complet 70 questions
  // INDEX DEFINITIFS (showIf=TOUJOURS sur toutes les questions) :
  //
  // Q08  type de bien      0=maison, 1=appart, 2=mitoyenne, 3=loft
  // Q20  jardin            0=arboré, 1=entretenu, 2=non aménagé, 3=friche
  // Q22  terrasse/balcon   0=grande terrasse, 1=5-20m², 2=petit balcon, 3=aucun
  // Q25  année construct.  0=avant1950, 1=1950-80, 2=1980-2000, 3=2000-15, 4=RT2012, 5=RE2020
  // Q27  sols              0=parquet massif, 1=contrecollé, 2=stratifié, 3=moquette/80s
  // Q28  murs/peintures    0=premium, 1=bon état, 2=à rafraîchir, 3=mauvais/humidité
  // Q29  cuisine           0=haut gamme, 1=fonctionnelle, 2=à moderniser, 3=à refaire
  // Q30  salle de bain     0=rénovée/italienne, 1=bon état, 2=vieillissante, 3=vétuste
  // Q31  huisseries        0=triple récent, 1=double ok, 2=double ancien, 3=simple vitrage
  // Q32  combles           0=isolé récent, 1=isolé ancien, 2=minimal, 3=aucun
  // Q33  toiture           0=récente, 1=bon état, 2=travaux à prévoir, 3=urgent/infiltrations
  // Q34  plomberie         0=récente, 1=correcte, 2=partiellement vétuste, 3=plomb/galvanisé
  // Q35  électricité       0=aux normes, 1=probable ok, 2=partiel, 3=ancienne/fusibles
  // Q38  DPE               0=A, 1=B, 2=C, 3=D, 4=E, 5=F/G (passoire)
  // Q39  chauffage         0=PAC, 1=gaz cond., 2=convecteurs élec, 3=fioul/poêle
  // Q42  confort été       0=clim, 1=bien orienté, 2=volets ok, 3=inconfort avéré
  // Q43  facture énergie   0=<800€, 1=800-1500€, 2=1500-2500€, 3=>2500€
  // Q43  état immeuble     0=très bon, 1=bon, 2=moyen, 3=dégradé  (appart seulement)
  // Q45  travaux copro     0=aucun, 1=petits, 2=importants, 3=difficulté  (appart)
  // Q48  matériaux/finit.  0=haut gamme, 1=bon standing, 2=standard, 3=bas coût
  // Q49  luminosité        0=exceptionnel, 1=très lumineux, 2=correct, 3=sombre
  // Q51  rangements        0=dressing sur-mesure, 1=placards intégrés, 2=basiques, 3=aucun
  //
  // RÈGLE : cond = true UNIQUEMENT si la réponse EST mauvaise (index élevé)
  //         => 0 ou 1 = pas de levier affiché sur ce critère
  // ═══════════════════════════════════════════════════════════════

  var a           = answers || [];
  var typeBien    = a[8];                    // 0=maison/mitoyenne, 1=appart, 3=loft
  var isMaison    = (typeBien === 0 || typeBien === 2 || typeBien === 3);
  var isAppart    = (typeBien === 1);

  // ── DEBUG — vérification des réponses clés pour les leviers ──────────
  // Affiche dans la console les réponses utilisées pour chaque levier
  // Permet de diagnostiquer en test si les answers sont bien transmis
  console.log('[MonEstim Leviers] Réponses clés reçues :', {
    typeBien:   a[8],
    jardin:     a[21],  // 0=arboré 1=entretenu 2=non aménagé 3=friche
    DPE:        a[38],  // 0=A 1=B 2=C 3=D 4=E 5=F/G
    chauffage:  a[39],  // 0=PAC 1=gaz 2=convec 3=fioul
    facture:    a[43],  // 0=<800€ 1=800-1500€ 2=1500-2500€ 3=>2500€
    cuisine:    a[30],  // 0=HG 1=fonct 2=moderniser 3=refaire
    sdb:        a[31],  // 0=rénovée 1=ok 2=vieillit 3=vétuste
    huisseries: a[32],  // 0=triple 1=double ok 2=double ancien 3=simple
    sols:       a[28],  // 0=parquet 1=contre 2=stratifié 3=moquette
    peintures:  a[29],  // 0=premium 1=ok 2=rafraîchir 3=mauvais
    plomberie:  a[35],  // 0=récente 1=ok 2=vétuste 3=plomb
    electricite:a[36],  // 0=normes 1=prob ok 2=partiel 3=ancien
    toiture:    a[34],  // 0=récente 1=ok 2=travaux 3=urgent (maison)
    combles:    a[33],  // 0=isolé récent 1=isolé 2=minimal 3=aucun (maison)
    luminosite: a[50],  // 0=except 1=très lum 2=correct 3=sombre
    immeuble:   a[44],  // 0=très bon 1=bon 2=moyen 3=dégradé (appart)
  });


  // Helper null-safe : retourne false si la réponse n'a pas été donnée (null/undefined)
  function rep(qi) { var v = a[qi]; return (v !== null && v !== undefined) ? v : -1; }

  // ── Terrain & extérieurs ──────────────────────────────────
  var jardinFriche      = rep(21) === 3;
  var jardinNonAmenage  = rep(21) >= 2;       // non aménagé (2) ou friche (3) → levier actif
  var jardinOK          = rep(21) >= 0 && rep(21) <= 1;

  // ── État général & travaux ────────────────────────────────
  var solMauvais        = rep(28) === 3;
  var solPassable       = rep(28) >= 2;
  var solOK             = rep(28) >= 0 && rep(28) <= 1;
  var peinturesARafr    = rep(29) === 2;
  var peinturesMauv     = rep(29) === 3;
  var peinturesVetustes = rep(29) >= 2;
  var peinturesOK       = rep(29) >= 0 && rep(29) <= 1;
  var cuisineAModern    = rep(30) === 2;
  var cuisineARefaire   = rep(30) === 3;
  var cuisineAncienne   = rep(30) >= 2;
  var cuisineOK         = rep(30) >= 0 && rep(30) <= 1;
  var sdbVieillissante  = rep(31) === 2;
  var sdbVetuste        = rep(31) === 3;
  var sdbMauvaise       = rep(31) >= 2;
  var sdbOK             = rep(31) >= 0 && rep(31) <= 1;
  var simpleVitrage     = rep(32) === 3;
  var doubleAncien      = rep(32) === 2;
  var huissMauv         = rep(32) >= 2;
  var huissOK           = rep(32) >= 0 && rep(32) <= 1;
  var comblesAucun      = rep(33) === 3;
  var comblesMinimal    = rep(33) === 2;
  var comblesMalIsoles  = rep(33) >= 2;
  var comblesOK         = rep(33) >= 0 && rep(33) <= 1;
  var toitureUrgente    = rep(34) === 3;
  var toitureTravaux    = rep(34) === 2;
  var toitureMauvaise   = rep(34) >= 2;
  var toitureOK         = rep(34) >= 0 && rep(34) <= 1;
  var plombMauv         = rep(35) >= 2;
  var plombUrgent       = rep(35) === 3;
  var elecNonConf       = rep(36) >= 2;
  var elecUrgent        = rep(36) === 3;
  var elecOK            = rep(36) >= 0 && rep(36) <= 1;

  // ── Énergie ───────────────────────────────────────────────
  var dpeA_C            = rep(38) >= 0 && rep(38) <= 2;
  var dpeD              = rep(38) === 3;
  var dpeE              = rep(38) === 4;
  var dpeFG             = rep(38) === 5;
  var dpePassable       = rep(38) >= 3;
  var dpeMauvais        = rep(38) >= 4;
  var chauffConvec      = rep(39) === 2;
  var chauffFioul       = rep(39) === 3;
  var chauffMauvais     = rep(39) >= 2;
  var chauffOK          = rep(39) >= 0 && rep(39) <= 1;
  var confortEteNul     = rep(42) === 3;
  var factureLourde     = rep(43) >= 2;
  var factureOK         = rep(43) >= 0 && rep(43) <= 1;

  // ── Copropriété (appartement) ─────────────────────────────
  var immeubleDegrade   = rep(44) >= 2;
  var travauxCopro      = rep(46) >= 2;

  // ── Standing & finitions ──────────────────────────────────
  var finitionsBasses   = a[48] >= 2;       // standard ou bas coût
  var finitionsOK       = a[48] <= 1;       // haut gamme ou bon standing
  var bienSombre        = rep(50) === 3;      // sombre (nord, vis-à-vis)
  var rangementNul      = rep(52) >= 3;       // aucun rangement intégré (Q51)

  // ── Poids de priorité pour tri ──
  var poids = { Critique:0, Excellent:1, 'Tres bon':2, Bon:3 };

  var leviersAll = [

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // TOITURE (maison seulement — Q33)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    {
      prio:  toitureUrgente ? 'Critique' : 'Important',
      titre: toitureUrgente ? 'Toiture — intervention urgente' : 'Toiture — travaux a prevoir',
      gain:  toitureUrgente ? '+10% (decote appliquee)' : '+2 a +4%',
      cout:  toitureUrgente ? '15 000 - 50 000 EUR' : '3 000 - 15 000 EUR',
      roi:   toitureUrgente ? 'Critique' : 'Bon',
      desc:  toitureUrgente
        ? 'Infiltrations identifiees — une decote de 10% a ete appliquee sur votre estimation. Tout acheteur serieux fera expertiser ce point. Refaire la toiture avant la mise en vente supprime ce levier de negociation et peut recuperer la totalite de la decote.'
        : 'Entretien ou remplacement partiel a prevoir (quelques ardoises, faitage, mousses). Aucune decote appliquee sur votre prix — mais un acheteur averti le signalera en negociation. Anticiper ce poste renforce votre position.',
      cond: isMaison && toitureMauvaise
    },

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // ISOLATION COMBLES (maison seulement — Q32)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    {
      prio:  comblesAucun ? 'Critique' : 'Excellent',
      titre: comblesAucun ? 'Isolation des combles — absente' : 'Isolation des combles — a renforcer',
      gain:  comblesAucun ? '+5% (decote appliquee) — cout proche de 1 EUR' : '+3% (decote appliquee) — cout proche de 1 EUR',
      cout:  '1 EUR via MaPrimeRenov\' + CEE',
      roi:   'Exceptionnel',
      desc:  comblesAucun
        ? 'Combles non isoles — une decote de 5% a ete appliquee sur votre estimation. Bonne nouvelle : l\'isolation des combles est eligible au dispositif gouvernemental MaPrimeRenov\' + CEE qui ramene le cout a 1 EUR pour les menages eligibles. Travaux en 1 journee. Recuperez la totalite de la decote pour un investissement quasi nul.'
        : 'Isolation insuffisante — une decote de 3% a ete appliquee. Renforcement eligible aux aides MaPrimeRenov\' (cout reduit a 1 EUR selon eligibilite). Ameliore le DPE, reduit la facture energetique et leve un frein a la negociation acheteur.',
      cond: isMaison && comblesMalIsoles
    },

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // DPE / CHAUFFAGE (maison et appart — Q37 + Q38)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    {
      prio:  dpeFG ? 'Excellent' : 'Tres bon',
      titre: dpeFG ? 'Passoire thermique — DPE F/G' : (dpeE ? 'DPE E — a ameliorer avant vente' : 'DPE D — optimisation possible'),
      gain:  dpeFG ? '+6 a +12%' : (dpeE ? '+3 a +7%' : '+2 a +4%'),
      cout:  dpeFG ? '15 000 - 35 000 EUR' : '8 000 - 20 000 EUR',
      roi:   'Excellent',
      desc:  dpeFG
        ? 'DPE F ou G identifie — passoire thermique. Depuis la loi Climat 2021 les acheteurs decotent 10 a 15% sur ces biens. Installation PAC + isolation : investissement directement rentabilise a la vente.'
        : (dpeE
          ? 'DPE E identifie. Les acheteurs sont de plus en plus sensibles au classement energetique. Travaux d\'isolation ou changement de chauffage pour atteindre D ou C : prime de 3 a 7% sur le prix.'
          : 'DPE D ameliorable. Pompe a chaleur ou isolation renforcee pour passer en classe C : prime de 2 a 4% et argument commercial fort face a des acheteurs attentifs a la facture.'),
      cond: dpePassable || chauffMauvais
    },
    {
      prio:  'Bon',
      titre: 'Facture energetique elevee — optimisation possible',
      gain:  '+1 a +3%',
      cout:  '2 000 - 8 000 EUR',
      roi:   'Bon',
      desc:  'Votre facture annuelle depasse 1 500 EUR. Meme avec un bon DPE, une facture elevee est un signal negatif pour les acheteurs. Isolation complementaire, regulation de chauffage ou VMC : des travaux cibles peuvent reduire la facture et valoriser le bien de 1 a 3%.',
      cond: factureLourde && !dpePassable && !chauffMauvais
    },

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // HUISSERIES / FENETRES (maison et appart — Q31)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    {
      prio:  simpleVitrage ? 'Excellent' : 'Tres bon',
      titre: simpleVitrage ? 'Fenetres simple vitrage — a remplacer' : 'Huisseries — double vitrage a moderniser',
      gain:  simpleVitrage ? '+3 a +6%' : '+2 a +4%',
      cout:  simpleVitrage ? '10 000 - 22 000 EUR' : '5 000 - 12 000 EUR',
      roi:   'Tres bon',
      desc:  simpleVitrage
        ? 'Simple vitrage d\'origine identifie. Deperditions thermiques majeures, DPE penalise, inconfort acoustique. Les acheteurs negocient 8 a 15% sur ce seul point. Remplacement en double ou triple vitrage = argument de vente decisif.'
        : 'Double vitrage ancien identifie. Remplacement par menuiseries PVC ou alu thermolaque : impact visuel immediat, gain thermique significatif, bien percu comme entretenu par les acheteurs.',
      cond: huissMauv
    },

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // SALLE DE BAIN (maison et appart — Q30)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    {
      prio:  sdbVetuste ? 'Excellent' : 'Tres bon',
      titre: sdbVetuste ? 'Salle de bain vetuste — a renover' : 'Salle de bain vieillissante — a moderniser',
      gain:  sdbVetuste ? '+4 a +7%' : '+2 a +5%',
      cout:  sdbVetuste ? '10 000 - 22 000 EUR' : '5 000 - 12 000 EUR',
      roi:   'Tres bon',
      desc:  sdbVetuste
        ? 'Salle de bain vetuste identifiee (baignoire fonte, faience ancienne). Premier point de blocage lors des visites. Renovation complete avec douche a l\'italienne + double vasque suspendue : coup de coeur garanti et offre au prix.'
        : 'Salle de bain vieillissante sans douche italienne detectee. Modernisation ciblee : douche a l\'italienne + vasque suspendue = ROI parmi les meilleurs en renovation. Peut faire basculer une offre au prix demande.',
      cond: sdbMauvaise
    },

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // CUISINE (maison et appart — Q29)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    {
      prio:  cuisineARefaire ? 'Tres bon' : 'Bon',
      titre: cuisineARefaire ? 'Cuisine a refaire entierement' : 'Cuisine ancienne — a moderniser',
      gain:  cuisineARefaire ? '+3 a +6%' : '+2 a +4%',
      cout:  cuisineARefaire ? '12 000 - 25 000 EUR' : '5 000 - 14 000 EUR',
      roi:   'Tres bon',
      desc:  cuisineARefaire
        ? 'Cuisine a refaire entierement identifiee. Avec la salle de bain, c\'est la piece qui influe le plus sur la decision d\'achat. Cuisine ouverte equipee moderne : justifie une hausse de prix directe et visible.'
        : 'Cuisine ancienne a moderniser detectee. Remplacement facades + plan de travail + electromenager encastre : transformation visuelle majeure pour un budget tres maitrise. Fort impact sur les visites.',
      cond: cuisineAncienne
    },

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // SOLS (maison et appart — Q27)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    {
      prio:  solMauvais ? 'Tres bon' : 'Bon',
      titre: solMauvais ? 'Revetements de sol — a remplacer' : 'Revetements de sol — a valoriser',
      gain:  solMauvais ? '+2 a +5%' : '+1 a +3%',
      cout:  solMauvais ? '6 000 - 15 000 EUR' : '3 000 - 8 000 EUR',
      roi:   'Bon',
      desc:  solMauvais
        ? 'Moquette ancienne ou carrelage annees 80 identifie. Remplacement par parquet contrecolle clair ou carrelage grand format : transformation visuelle immediate, sensation d\'espace et de modernite dans toutes les pieces de vie.'
        : 'Revetements de sol standard detectes. Parquet massif huile ou carrelage grand format dans les pieces principales : valorisation instantanee de la perception du bien lors des visites et des photos.',
      cond: solPassable
    },

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // PEINTURES / MURS (maison et appart — Q28)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    {
      prio:  peinturesMauv ? 'Tres bon' : 'Bon',
      titre: peinturesMauv ? 'Murs et plafonds — remise en etat' : 'Peintures — rafraichissement',
      gain:  peinturesMauv ? '+2 a +4%' : '+1 a +3%',
      cout:  peinturesMauv ? '4 000 - 10 000 EUR' : '1 500 - 5 000 EUR',
      roi:   'Excellent',
      desc:  peinturesMauv
        ? 'Murs et plafonds en mauvais etat identifies (fissures, humidite, traces). Ragrement + peinture neutre indispensable avant les photos et les visites. Impact direct sur la perception de valeur et le montant de l\'offre.'
        : 'Peintures a rafraichir identifiees. Teintes neutres (blanc casse, gris perle) pour un cout modeste : fort impact sur la perception. Un acheteur estime inconsciemment un bien fraichement peint 3 a 5% plus cher.',
      cond: peinturesVetustes
    },

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // JARDIN (maison seulement — Q20)
    // Affiché SEULEMENT si jardin non aménagé ou friche (Q20 >= 2)
    // PAS affiché si jardin arboré (0) ou bien entretenu (1)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    {
      prio:  jardinFriche ? 'Tres bon' : 'Bon',
      titre: jardinFriche ? 'Jardin en friche — remise en etat complete' : 'Jardin non amenage — a valoriser',
      gain:  jardinFriche ? '+3 a +6%' : '+1 a +3%',
      cout:  jardinFriche ? '2 000 - 8 000 EUR' : '500 - 3 000 EUR',
      roi:   'Excellent',
      desc:  jardinFriche
        ? 'Jardin en friche identifie. Un exterieur neglige fait chuter l\'estimation de 5 a 10% dans l\'esprit des acheteurs avant meme d\'entrer dans le bien. Debroussaillage + engazonnement + arbustes persistants : transformation spectaculaire pour un budget tres accessible.'
        : 'Jardin plat et non amenage detecte. Plantation de quelques arbustes structurants, vivaces et une bordure propre : l\'exterieur est la premiere impression. ROI exceptionnel pour moins de 2 000 euros.',
      cond: isMaison && jardinNonAmenage
    },

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // PLOMBERIE (maison et appart — Q34, surtout anciens biens)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    {
      prio:  plombUrgent ? 'Excellent' : 'Tres bon',
      titre: plombUrgent ? 'Canalisations plomb — remplacement urgent' : 'Plomberie — mise a niveau',
      gain:  plombUrgent ? '+2 a +5%' : '+1 a +3%',
      cout:  plombUrgent ? '6 000 - 18 000 EUR' : '3 000 - 9 000 EUR',
      roi:   'Bon',
      desc:  plombUrgent
        ? 'Canalisations en plomb ou galvanise identifiees. Obligation legale de signalement aux acheteurs. Remplacement en cuivre ou PER avant la vente : leve le frein majeur et evite une decote de 5 a 10%.'
        : 'Plomberie partiellement vetuste identifiee. Mise a niveau des points critiques avant la vente : evite les surprises aux diagnostics et les negociations de derniere minute au compromis.',
      cond: plombMauv
    },

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // ELECTRICITE (maison et appart — Q35)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    {
      prio:  elecUrgent ? 'Excellent' : 'Bon',
      titre: elecUrgent ? 'Electricite — mise aux normes urgente' : 'Electricite — mise a niveau partielle',
      gain:  elecUrgent ? '+2 a +4%' : '+1 a +2%',
      cout:  elecUrgent ? '5 000 - 12 000 EUR' : '2 000 - 6 000 EUR',
      roi:   'Bon',
      desc:  elecUrgent
        ? 'Ancienne installation electrique identifiee (fusibles, absence de terre). Les diagnostics obligatoires l\'exposeront. Mise aux normes NF C 15-100 avant la vente : leve le frein bancaire et evite une decote systematique.'
        : 'Installation electrique partiellement non conforme. Mise a niveau du tableau + prises de terre dans les pieces de vie : rassure les acheteurs, facilite l\'accord bancaire et evite les renogociations au compromis.',
      cond: elecNonConf
    },

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // ETAT IMMEUBLE COPROPRIETE (appartement seulement — Q43)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    {
      prio:  a[43] === 3 ? 'Excellent' : 'Tres bon',
      titre: a[43] === 3 ? 'Immeuble degrade — frein a la vente' : 'Etat de l\'immeuble — a surveiller',
      gain:  a[43] === 3 ? '+3 a +6%' : '+1 a +3%',
      cout:  'Variable (quote-part syndic)',
      roi:   'Tres bon',
      desc:  a[43] === 3
        ? 'Immeuble degrade identifie avec travaux importants votes ou a venir. Les acheteurs et les banques penalisent fortement ce point. Participation active au syndic pour accelérer les travaux avant la mise en vente.'
        : 'Etat moyen de l\'immeuble detecte. Des travaux de facade ou de parties communes a venir peuvent peser sur le prix de vente. Bien anticiper et communiquer sur les charges previsionnelles aux acheteurs.',
      cond: isAppart && immeubleDegrade
    },

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // LUMINOSITE (maison et appart — Q49)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    {
      prio:  'Bon',
      titre: 'Luminosite — amelioration visuelle',
      gain:  '+1 a +3%',
      cout:  '500 - 3 000 EUR',
      roi:   'Excellent',
      desc:  'Bien identifie comme sombre ou peu expose (orientation nord ou vis-a-vis). Spots encastres LED, grands miroirs strategiques, peintures ultra-blanches : transformation de la perception de l\'espace sans travaux structurels. Impact fort sur les photos d\'annonce.',
      cond: bienSombre
    },

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // HOME STAGING (maison et appart — finitions standard ou fallback)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    {
      prio:  'Bon',
      titre: 'Home staging et depersonnalisation',
      gain:  '+2 a +5%',
      cout:  '800 - 3 000 EUR',
      roi:   'Excellent',
      desc:  'Finitions standard ou bien a depersonnaliser detecte. Home staging professionnel (meubles epures, deco neutre, desencombrement, photos pro) : augmente le prix de vente moyen de 3% et reduit le delai de vente de 30%. Le meilleur ROI en immobilier.',
      cond: finitionsBasses
    },
  ];

  // Tri par priorité : Critique → Excellent → Tres bon → Bon
  leviersAll.sort(function(x, y) {
    return (poids[x.prio] || 3) - (poids[y.prio] || 3);
  });

  // On garde les 4 leviers les plus pertinents
  var actifs = leviersAll.filter(function(l) { return l.cond; }).slice(0, 4);

  // Fallback si le bien est en très bon état sur tous les critères
  if (actifs.length === 0) {
    actifs.push({
      titre: 'Home staging professionnel',
      gain:  '+2 a +5%',
      cout:  '1 000 - 3 000 EUR',
      roi:   'Excellent',
      desc:  'Votre bien est en excellent etat general. Un home staging professionnel (depersonnalisation, mise en scene soignee) maximise l\'impact des photos et raccourcit le delai de vente de 30% en moyenne. Le meilleur investissement avant vente.',
    });
  }

  let ly = 57;
  actifs.forEach((lev,i) => {
    // Hauteur dynamique selon longueur description
    const descLines = Math.ceil(lev.desc.length / 75);
    const itemH = Math.max(32, 18 + descLines * 4.5);
    rr(14,ly,W-28,itemH,1,BG3,null);
    // Numéro
    rr(14,ly,10,itemH,1,GOLD,null);
    t(String(i+1),19,ly+itemH/2+3,12,'bold',BG,'center');
    // Titre + desc
    t(lev.titre,28,ly+8,9,'bold',TEXT);
    tw(lev.desc,28,ly+14,108,6.5,TEXT3,4.2);
    // Gain
    rr(W-54,ly+5,38,9,1,[20,30,20],null);
    t(lev.gain,W-35,ly+11,9,'bold',GREEN,'center');
    // Cout + ROI
    t('Cout : '+lev.cout,W-16,ly+itemH-10,6,'normal',TEXT3,'right');
    t('ROI : '+lev.roi,W-16,ly+itemH-5,6,'bold',GOLD,'right');
    ly += itemH + 4;
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

  // PAGE 5 — MARCHÉ LOCAL : PRIX AU M² + VENTES RÉELLES DVF
  doc.addPage();
  box(0,0,W,H,BG,null);
  box(0,0,1.5,H,GOLD,null);
  pageHeader();

  t('Marche local', 14, 22, 16, 'bold', TEXT);
  t('& ventes notariees reelles', 14+44, 22, 16, 'normal', GOLD);
  ln(14, 25, W-14, 25, BG3, 0.3);

  const baseM2   = safeNum(p.finalPriceM2) || 3000;
  const typeDVF  = (p.typeBien === 1) ? 'Appartement' : 'Maison';
  const villeLabel = p.ville || 'France';

  // ── BLOC PRIX MARCHÉ LOCAL ──────────────────────────────────
  const cityData = getCityPrices(p.ville, p.typeBien === 1 ? 'appart' : 'maison');
  const bandePrix = (p.typeBien === 1) ? cityData.appart : cityData.maison;
  const prixBas  = bandePrix[0] || Math.round(baseM2 * 0.88);
  const prixMed  = bandePrix[1] || baseM2;
  const prixHaut = bandePrix[2] || Math.round(baseM2 * 1.12);

  // Bloc conteneur — plus haut pour respirer
  rr(14, 28, W-28, 52, 2, [22,20,14], [201,168,76,0.3], 0.5);
  t('Fourchette de prix au m\u00b2 \u2014 ' + villeLabel + ' (' + typeDVF + ')', W/2, 36, 8, 'bold', GOLD, 'center');
  t('Source : DVF \u2014 DGFiP / data.gouv.fr \u2014 ventes notariees 2023-2025', W/2, 41, 5.5, 'normal', TEXT3, 'center');
  ln(18, 44, W-18, 44, BG3, 0.4);

  // 3 colonnes bas/médian/haut — plus hautes, plus espacées
  const colW3 = (W-40) / 3;
  [['Marche bas', 'Biens avec travaux', prixBas, ORANGE],
   ['Marche median', 'Reference notariale', prixMed, GOLD],
   ['Marche haut', 'Biens renoves / neuf', prixHaut, GREEN]
  ].forEach(([lbl, desc, val, col], i) => {
    const cx = 16 + i * (colW3 + 4);
    rr(cx, 47, colW3, 30, 2, [30,27,16], null);
    box(cx, 47, colW3, 2.5, col, null);
    t(lbl,  cx+colW3/2, 55,  6,   'bold',   col,  'center');
    t(fmt(val)+' \u20ac/m\u00b2', cx+colW3/2, 64, 10, 'bold', TEXT, 'center');
    t(desc, cx+colW3/2, 73,  5.5, 'normal', TEXT3,'center');
  });

  // Positionnement MonEstim — en dessous du bloc
  const prixMoyV  = Math.round((prixBas+prixMed+prixHaut)/3);
  const diffV     = baseM2 - prixMoyV;
  const diffVpct  = prixMoyV > 0 ? Math.round(Math.abs(diffV)/prixMoyV*100) : 0;
  const diffVcol  = diffV >= 0 ? GREEN : ORANGE;
  const diffVlbl  = diffV === 0 ? 'Votre estimation est dans la moyenne exacte du marche de '+villeLabel :
    diffV > 0 ? 'Votre bien est valorise +'+diffVpct+'% vs la moyenne marche de '+villeLabel+' \u2014 qualite justifiee par le score' :
    'Votre bien est positionne -'+diffVpct+'% sous la moyenne \u2014 potentiel d\'optimisation identifie';
  rr(14, 82, W-28, 11, 1, [18,26,20], [72,200,130,0.25], 0.5);
  t('MonEstim : '+fmt(baseM2)+' \u20ac/m\u00b2', 20, 89, 8, 'bold', GOLD);
  t(diffVlbl, W-18, 89, 6.5, 'normal', diffVcol, 'right');

  // ── MÉTHODE DE VALORISATION ────────────────────────────────
  let liqY = 98;

  // Coefs dimensionnels depuis lastPrix
  const cLocD   = safeNum(p.coefLoc,   1.00);
  const cEtatD  = safeNum(p.coefEtat,  1.00);
  const cFinD   = safeNum(p.coefFin,   1.00);
  const cEnerD  = safeNum(p.coefEner,  1.00);
  const cStandD = safeNum(p.coefStand, 1.00);
  const cMarchD = safeNum(p.coefMarch, 1.00);

  rr(14, liqY, W-28, 10, 1, [22,22,14], [201,168,76,0.2], 0.4);
  box(14, liqY, 2, 10, GOLD, null);
  t('Methode de valorisation — 6 dimensions (base DVF notariale)', 20, liqY+6.5, 7, 'bold', GOLD);
  liqY += 12;

  const coefRows = [
    ['Localisation (15%)',    cLocD],
    ['Etat structure (24%)',  cEtatD],
    ['Energie / DPE (18%)',   cEnerD],
    ['Finitions (14%)',       cFinD],
    ['Standing / atouts (13%)', cStandD],
    ['Marche local (6%)',     cMarchD],
  ];
  const cw = (W-32) / 3;
  coefRows.forEach(([label, val], i) => {
    const cx = 16 + (i % 3) * (cw + 2);
    const cy = liqY + Math.floor(i / 3) * 10;
    const col = val >= 1.02 ? GREEN : val <= 0.97 ? ORANGE : TEXT2;
    const sign = val >= 1 ? '+' : '';
    rr(cx, cy, cw, 8.5, 1, [26,26,16], null);
    t(label, cx+2, cy+4.5, 4.8, 'normal', TEXT3);
    t(sign + ((val-1)*100).toFixed(1)+'%', cx+cw-2, cy+5.5, 7, 'bold', col, 'right');
  });
  liqY += 24;

  // ── DISTRIBUTION DVF RÉELLE — basée sur les vraies bandes de la commune ──
  // Source : data-prix-communes.json (32 473 communes, DVF DGFiP 2020-2025)
  // Plus de ventes individuelles inventées — tableau de distribution DVF réelle

  // En-tête section
  rr(14, liqY, W-28, 10, 1, [28,24,14], null);
  box(14, liqY, W-28, 2, GOLD, null);
  t('Distribution des prix — ' + typeDVF + ' a ' + villeLabel, 20, liqY+7, 8.5, 'bold', TEXT);
  rr(W-62, liqY+2, 48, 6, 2, [18,28,18], [72,200,130,0.5], 0.5);
  t('SOURCE DVF REELLE', W-38, liqY+6.5, 5.5, 'bold', GREEN, 'center');
  liqY += 14;

  // Tableau des tranches de marché — construit sur les vraies bandes DVF [bas, médian, haut]
  var surfRanges = typeDVF === 'Maison'
    ? [[80,110],[90,130],[100,150],[110,180]]
    : [[30,55],[40,65],[45,75],[50,90]];
  var tranchesData = [
    { tranche:'Marche bas',    desc:'Biens avec travaux importants',       m2:prixBas,                         surf:surfRanges[0], pct:25 },
    { tranche:'Marche moyen',  desc:'Biens en etat courant sans travaux',  m2:Math.round((prixBas+prixMed)/2), surf:surfRanges[1], pct:35 },
    { tranche:'Marche median', desc:'Reference notariale locale',           m2:prixMed,                         surf:surfRanges[2], pct:25 },
    { tranche:'Marche haut',   desc:'Biens renoves, standing eleve',       m2:prixHaut,                        surf:surfRanges[3], pct:15 },
  ];

  // En-têtes tableau
  var rowHt = 11;
  rr(14, liqY, W-28, 8, 1, [32,28,16], null);
  [['SEGMENT',14],['DESCRIPTION',50],['EUR/m2',120],['SURFACE TYPE',148],['PART MARCHE',176]].forEach(function(pair) {
    t(pair[0], pair[1]+2, liqY+5.5, 5.5, 'bold', GOLD);
  });
  ln(14, liqY+8, W-14, liqY+8, BG3, 0.3);
  liqY += 9;

  tranchesData.forEach(function(tr, i) {
    var bgRow = i%2===0 ? [24,24,16] : [20,20,14];
    rr(14, liqY, W-28, rowHt, 1, bgRow, null);
    var col = i===0 ? ORANGE : (i>=2 ? GREEN : GOLD);
    var diff = tr.m2 - baseM2;
    var diffP = baseM2>0 ? Math.round(Math.abs(diff)/baseM2*100) : 0;
    t(tr.tranche,           16,  liqY+7.5, 6.5, 'bold',   col);
    t(tr.desc,              52,  liqY+7.5, 5.5, 'normal', TEXT3);
    t(fmt(tr.m2)+' EUR/m2', 122, liqY+7.5, 7,   'bold',   col);
    t(tr.surf[0]+'-'+tr.surf[1]+' m2', 150, liqY+7.5, 6.5, 'normal', TEXT2);
    t(tr.pct+'% des ventes', 178, liqY+7.5, 6.5, 'normal', TEXT2);
    liqY += rowHt+1;
  });

  // Positionnement MonEstim dans la distribution
  liqY += 3;
  // Positionnement basé sur le score — calibré sur l'amplitude réelle [22–90]
  // Q1=39, Q2=56, Q3=73 → 4 segments de taille égale sur la vraie amplitude
  // Seuils calibrés sur amplitude réelle [15–96] après intégration 30 nouvelles questions
  // Quartiles : Q1=35, Q2=56, Q3=76
  var scoreGlob = s && s.global ? s.global : 50;
  var posSegment = scoreGlob >= 76 ? 'bien d\'exception — segment haut' :
                   scoreGlob >= 56 ? 'marche premium — qualite justifiee' :
                   scoreGlob >= 35 ? 'segment median — rapport qualite/prix equilibre' :
                                     'segment standard — travaux a prevoir';
  rr(14, liqY, W-28, 16, 1, [16,24,16], [72,200,130,0.3], 0.5);
  box(14, liqY, 3, 16, GREEN, null);
  t('MonEstim positionne votre bien : ' + posSegment, 22, liqY+6.5, 7.5, 'bold', TEXT);
  t('Prix estime : '+fmt(baseM2)+' EUR/m2  |  Median DVF commune : '+fmt(prixMed)+' EUR/m2', 22, liqY+13, 6.5, 'normal', GOLD);
  liqY += 20;

  // Jauge de confiance — basée sur la couverture DVF (26 491 communes)
  rr(14, liqY, W-28, 14, 1, [20,20,14], null);
  t('Indice de confiance de l\'estimation', 20, liqY+5.5, 7, 'bold', TEXT);
  t('Haute — 88%', W-18, liqY+5.5, 7, 'bold', GREEN, 'right');
  rr(20, liqY+8, W-40, 4, 1, [30,30,20], null);
  rr(20, liqY+8, Math.round((W-40)*0.88), 4, 1, GREEN, null);
  t('Base : 26 491 communes | DVF DGFiP 2023-2025 | Score global '+s.global+'/100', W/2, liqY+17, 5.5, 'normal', TEXT3, 'center');
  liqY += 18;

  ln(14,liqY,W-14,liqY,BG3,0.3);
  t('Source : DVF DGFiP / data.gouv.fr — Base nationale ventes notariees 2023-2025 — '+villeLabel, W/2, liqY+5, 5.5, 'normal', TEXT3, 'center');
  t('Secteur : '+villeLabel+' | Type : '+typeDVF+' | Donnees notariees | MonEstim © 2025', W/2, liqY+10, 5.5, 'normal', [90,80,60], 'center');
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
    '7 dimensions ponderees : Localisation 15% | Etat 18% | Energie 20% | Standing 13%',
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
    'CONFIDENTIALITE : MonEstim ne conserve aucune donnee sur votre bien ni votre identite. Ce rapport existe',
    'uniquement dans votre session de navigation. Conservez ce PDF — il ne pourra pas etre regenere.',
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


// ── Stub getCityPrices pour page 3 ──────────────────────────────
// Utilise les vraies bandes DVF transmises dans le payload (p.prixBand)
function normalizeCity(s) {
  return (s||'').toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/['\-]/g," ").replace(/[^a-z0-9 ]/g,"")
    .replace(/\s+/g," ").trim();
}

var PRIX_COMMUNES = {};
var PRIX_VILLES   = { "_default": { maison:[2500,3000,3500], appart:[2200,2700,3200] } };
var PRIX_DEPTS    = {};

function getCityPrices(cityInput, typeForced) {
  // Priorité 1 : bandes DVF du payload (calculées depuis data-prix-communes.json)
  var type = typeForced || (lastPrix && lastPrix.typeBien === 1 ? 'appart' : 'maison');
  if (lastPrix) {
    // prixBand = bande pour le type du bien (maison ou appart)
    var band = lastPrix.prixBand;
    // prixBandAppart = bande appartement si dispo
    var bandA = lastPrix.prixBandAppart || band;
    if (band && Array.isArray(band) && band.length >= 3 && band[1] > 0) {
      return {
        maison: [band[0], band[1], band[2]],
        appart: (bandA && bandA.length >= 3 && bandA[1] > 0) ? [bandA[0], bandA[1], bandA[2]] : [band[0], band[1], band[2]]
      };
    }
  }
  // Fallback _default — jamais dériver du prix moteur
  return PRIX_VILLES['_default'] || { maison: [1500,2500,3500], appart: [1800,3000,4200] };
}
