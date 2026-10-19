const WHATSAPP = "34673629342";
const HOME = "../index.html";
const FILE_LIMIT = 20 * 1024 * 1024;

const journeys = {
  personalizados: {
    kind: "product", title: "Personalización textil y objetos", kicker: "Camisetas · tazas · regalos de marca", category: "Personalizados", heading: "Tu idea,\nhecha para llevar.", intro: "Camisetas, tazas y objetos con tu diseño. Elige qué quieres personalizar, comparte tu referencia y te ayudamos a escoger la técnica adecuada.", visual: "shirt", visualLabel: "DE TU IDEA A UNA PIEZA REAL", promise: "Primero revisamos tu diseño. Confirmamos precio y producción antes del pago.", fields: [
      {name:"product", label:"¿Qué quieres personalizar?", type:"select", options:["Camiseta", "Sudadera", "Taza", "Bolsa de tela", "Objeto personalizado"]},
      {name:"technique", label:"Técnica o acabado", type:"select", options:["Quiero que me asesoren", "Vinilo textil", "Impresión DTF", "Impresión UVI", "Bordado"]},
      {name:"quantity", label:"Unidades", type:"number", min:1, value:1},
      {name:"size", label:"Tallas o medidas", type:"text", placeholder:"Ej. 12 camisetas: 6 M, 4 L y 2 XL"}
    ], description:"Añade una nota sobre color, colocación del diseño o fecha deseada."
  },
  rotulos: {
    kind: "quote", title: "Rótulos luminosos a medida", kicker: "Fachadas · escaparates · interiores", category: "Rótulos luminosos", heading: "Una marca que\nse ve de día y de noche.", intro: "Cuéntanos cómo es tu espacio y qué quieres comunicar. Diseñamos rótulos luminosos para que encajen con tu negocio y su entorno.", visual: "sign", visualLabel: "DISEÑO, FABRICACIÓN E INSTALACIÓN", promise: "La instalación y los materiales se concretan tras revisar el espacio.", fields: [
      {name:"sign", label:"Tipo de rótulo", type:"select", options:["Letras corpóreas iluminadas", "Caja de luz", "Rótulo retroiluminado", "Todavía no lo sé"]},
      {name:"width", label:"Ancho aproximado · cm", type:"number", min:1, placeholder:"120"},
      {name:"height", label:"Alto aproximado · cm", type:"number", min:1, placeholder:"60"},
      {name:"installation", label:"¿Necesitas instalación?", type:"select", options:["Sí, en Madrid", "No, solo fabricación", "Lo hablamos"]},
      {name:"location", label:"¿Dónde irá instalado?", type:"text", placeholder:"Fachada, interior, escaparate…"}
    ], description:"Añade la dirección o una foto de la fachada para valorar el montaje."
  },
  granformato: {
    kind: "product", title: "Impresión de gran formato", kicker: "Vinilo impreso · lonas · escaparates", category: "Gran formato", heading: "Haz que te vean\na lo grande.", intro: "Prepara vinilos, lonas y gráficas de gran formato para tu negocio, evento o espacio. Dinos el tamaño y dónde se va a colocar.", visual: "format", visualLabel: "GRÁFICA PREPARADA PARA TU ESPACIO", promise: "El soporte y el acabado se confirman según el uso y la superficie.", fields: [
      {name:"support", label:"¿Qué necesitas imprimir?", type:"select", options:["Lona", "Vinilo impreso", "Vinilo para escaparate", "Póster gran formato", "Necesito consejo"]},
      {name:"width", label:"Ancho · cm", type:"number", min:1, placeholder:"200", required:true},
      {name:"height", label:"Alto · cm", type:"number", min:1, placeholder:"100", required:true},
      {name:"quantity", label:"Unidades", type:"number", min:1, value:1},
      {name:"finish", label:"Acabado", type:"select", options:["Interior", "Exterior", "Con ollados", "Por confirmar"]}
    ], description:"Indica si necesitas diseño, instalación o entrega en una fecha concreta."
  },
  vinilo: {
    kind: "product", title: "Compra vinilo por metros", kicker: "Vinilo de corte · color · acabado", category: "Vinilo por metros", heading: "El vinilo que necesitas,\npor los metros que necesitas.", intro: "Escoge la familia de vinilo, define el ancho y los metros. Si tienes dudas entre un acabado u otro, adjunta una referencia y te orientamos.", visual: "vinyl", visualLabel: "ELIGE COLOR Y METRAJE", promise: "El precio final depende del tipo, ancho y acabado seleccionados en el catálogo.", fields: [
      {name:"type", label:"Tipo de vinilo", type:"select", options:["Vinilo de corte", "Vinilo de impresión", "Vinilo transparente", "Vinilo para escaparate", "Necesito consejo"]},
      {name:"width", label:"Ancho del rollo", type:"select", options:["A consultar", "Ancho estándar", "Otro ancho"]},
      {name:"finish", label:"Color o acabado", type:"text", placeholder:"Ej. azul brillo, blanco mate"},
      {name:"quantity", label:"Metros lineales", type:"number", min:0.1, step:0.1, value:1, required:true}
    ], description:"El metraje se prepara en una pieza continua, sujeto a disponibilidad del rollo."
  },
  pvc: {
    kind: "product", title: "PVC y metacrilato cortados a medida", kicker: "Planchas · piezas · fresado", category: "PVC y metacrilato", heading: "De la plancha\na la medida exacta.", intro: "Selecciona PVC o metacrilato y comparte las dimensiones de tus piezas. También puedes adjuntar el archivo de corte para que el taller lo revise.", visual: "sheet", visualLabel: "MATERIAL Y MEDIDAS A TU PROYECTO", promise: "Grosor, acabado y tolerancias se confirmarán con el taller antes del pago.", fields: [
      {name:"material", label:"Material", type:"select", options:["PVC espumado", "Metacrilato transparente", "Metacrilato opal", "Metacrilato de color", "Necesito consejo"]},
      {name:"thickness", label:"Grosor", type:"select", options:["A consultar", "3 mm", "5 mm", "10 mm", "Otro grosor"]},
      {name:"width", label:"Ancho de pieza · mm", type:"number", min:50, placeholder:"600", required:true},
      {name:"height", label:"Alto de pieza · mm", type:"number", min:50, placeholder:"400", required:true},
      {name:"quantity", label:"Piezas", type:"number", min:1, value:1}
    ], description:"Si son varias piezas, explica si tienen formas o medidas distintas."
  },
  laser: {
    kind: "product", title: "Corte láser y piezas a medida", kicker: "Corte de precisión · series cortas", category: "Corte láser", heading: "Tu archivo,\ncortado con precisión.", intro: "Envía un diseño o cuéntanos la forma que necesitas. Revisaremos el material, el grosor y el tipo de corte antes de preparar la producción.", visual: "laser", visualLabel: "ARCHIVO REVISADO ANTES DE CORTAR", promise: "La compatibilidad del archivo y el material se revisan antes de confirmar el pedido.", fields: [
      {name:"material", label:"Material", type:"select", options:["Metacrilato", "Madera", "PVC", "Otro material", "Necesito consejo"]},
      {name:"thickness", label:"Grosor · mm", type:"number", min:1, placeholder:"3"},
      {name:"width", label:"Ancho aproximado · mm", type:"number", min:1, placeholder:"300"},
      {name:"height", label:"Alto aproximado · mm", type:"number", min:1, placeholder:"200"},
      {name:"quantity", label:"Unidades", type:"number", min:1, value:1, required:true}
    ], description:"Adjunta un archivo vectorial si lo tienes. El equipo te confirma si está listo para corte."
  },
  proyecto: {
    kind: "quote", title: "Cuéntanos tu proyecto", kicker: "Tienes una idea y te ayudamos a darle forma", category: "Proyecto a medida", heading: "Empecemos por\ntu idea.", intro: "Sube una imagen, describe lo que imaginas o solicita una visita al taller. Una persona del equipo te orientará sobre materiales, medidas y siguientes pasos.", visual: "idea", visualLabel: "HABLAMOS ANTES DE PRODUCIR", promise: "La fecha de visita y el presupuesto quedan pendientes de confirmación.", fields: [
      {name:"project", label:"¿Qué tienes en mente?", type:"select", options:["Camisetas, tazas u objetos", "Rótulo luminoso", "Vinilos o lonas", "PVC o metacrilato", "Corte láser", "Otro proyecto"]},
      {name:"visit", label:"Fecha preferida para visitarnos", type:"datetime-local"},
      {name:"name", label:"Tu nombre", type:"text", autocomplete:"name", required:true, placeholder:"¿Cómo te llamas?"},
      {name:"phone", label:"Tu teléfono", type:"tel", autocomplete:"tel", required:true, placeholder:"Para poder responderte"},
      {name:"email", label:"Tu email", type:"email", autocomplete:"email", required:true, placeholder:"nombre@empresa.com"}
    ], description:"Una foto del espacio o una referencia visual nos ayuda a entender mejor la idea."
  }
};

const items = [
  ["personalizados.html", "Personalizados", "Camisetas, tazas y objetos con tu marca.", "shirt"],
  ["rotulos-luminosos.html", "Rótulos luminosos", "Letras, cajas de luz y señalética con presencia.", "sign"],
  ["gran-formato.html", "Gran formato", "Vinilos impresos, lonas y gráficas para espacios.", "format"],
  ["vinilo-por-metros.html", "Vinilo por metros", "Elige tipo, acabado y cantidad para el taller.", "vinyl"],
  ["pvc-metacrilato.html", "PVC y metacrilato", "Piezas cortadas y fresadas a las medidas de tu proyecto.", "sheet"],
  ["corte-laser.html", "Corte láser", "Piezas de precisión a partir de tu idea o archivo.", "laser"],
  ["proyecto-a-medida.html", "Un proyecto especial", "Sube una referencia o agenda una visita al taller.", "idea"]
];

const journeyFaqs = {
  personalizados:[
    ["¿Qué diseño puedo enviar?","Puedes subir una imagen o archivo de referencia. El taller revisa la resolución y te recomienda la técnica adecuada."],
    ["¿Hay pedido mínimo?","Las cantidades y el precio dependen del producto y del acabado. Te confirmaremos el total antes de producir."],
    ["¿Puedo elegir tallas distintas?","Sí. Indica las tallas y unidades en las notas del pedido para que podamos preparar la propuesta."]
  ],
  rotulos:[
    ["¿Instaláis el rótulo?","Podemos valorar fabricación e instalación. Añade la dirección o una foto del espacio y confirmaremos el alcance."],
    ["¿Cuánto cuesta un rótulo luminoso?","El precio depende de medidas, materiales, iluminación y montaje. Recibirás presupuesto antes de confirmar."],
    ["¿Puedo enviar mi logotipo?","Sí. Sube una imagen o archivo para que el taller revise el diseño y su viabilidad."]
  ],
  granformato:[
    ["¿Qué soporte necesito para exterior?","Depende del tiempo de exposición y de la superficie. Indica dónde se instalará para recomendarte un material."],
    ["¿Puedo pedir instalación?","Sí. Añade la ubicación y te confirmaremos si el servicio de instalación encaja con el trabajo."],
    ["¿Cómo se calcula el precio?","Se confirma según soporte, medidas, acabado y cantidad antes de producir."]
  ],
  vinilo:[
    ["¿Puedo pedir varios metros en una sola pieza?","Indica el metraje continuo que necesitas. La longitud final depende de la disponibilidad del rollo."],
    ["¿Hay diferentes anchos y acabados?","La tienda muestra las variantes disponibles. Si necesitas otro ancho o acabado, consúltanos antes de comprar."],
    ["¿Cuándo pago?","El precio y la disponibilidad se confirman antes de completar el pago en la tienda online."]
  ],
  pvc:[
    ["¿Puedo indicar medidas especiales?","Sí. Añade las dimensiones de cada pieza y un archivo de corte si lo tienes. Las medidas especiales se presupuestan antes de pagar."],
    ["¿Qué grosor puedo elegir?","Las opciones de grosor disponibles aparecerán en la tienda. Para otro grosor, consulta con el taller."],
    ["¿Se puede pulir o fresar el canto?","Indica el acabado que necesitas y confirmaremos si es compatible con el material elegido."]
  ],
  laser:[
    ["¿Qué formato de archivo puedo enviar?","Aceptamos referencias en imagen y archivo vectorial. El taller revisa la compatibilidad antes de producir."],
    ["¿Puedo pedir una sola pieza?","Indica la cantidad y el tamaño. Te confirmaremos si el material y el corte encajan con el equipo."],
    ["¿El precio se calcula al instante?","Los trabajos con precio variable se revisan primero. Te enviaremos el total antes del pago."]
  ],
  proyecto:[
    ["¿La visita queda reservada al elegir fecha?","No. La fecha es una preferencia y el equipo te contactará para confirmarla."],
    ["¿Cómo envío una imagen?","Selecciona un archivo de referencia. En dispositivos compatibles puedes compartirlo junto con el mensaje; en otro caso, adjúntalo en WhatsApp."],
    ["¿Cuándo recibo el presupuesto?","El equipo revisará la idea y se pondrá en contacto para confirmar detalles, precio y plazo."]
  ]
};

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
}

function fieldMarkup(field) {
  const required = field.required ? " required" : "";
  const autocomplete = field.autocomplete ? ` autocomplete="${esc(field.autocomplete)}"` : "";
  const placeholder = field.placeholder ? ` placeholder="${esc(field.placeholder)}"` : "";
  if (field.type === "select") {
    return `<label class="experience-field">${esc(field.label)}<select name="${esc(field.name)}"${required}><option value="" disabled selected>Seleccionar</option>${field.options.map((option) => `<option>${esc(option)}</option>`).join("")}</select></label>`;
  }
  if (field.type === "textarea") {
    return `<label class="experience-field experience-field-wide">${esc(field.label)}<textarea name="${esc(field.name)}" rows="4"${placeholder}${required}></textarea></label>`;
  }
  return `<label class="experience-field">${esc(field.label)}<input name="${esc(field.name)}" type="${esc(field.type)}"${field.min !== undefined ? ` min="${field.min}"` : ""}${field.step ? ` step="${field.step}"` : ""}${field.value !== undefined ? ` value="${field.value}"` : ""}${placeholder}${autocomplete}${required}></label>`;
}

function renderHub() {
  return `<main class="shop-hub" id="contenido"><nav class="breadcrumbs"><a href="${HOME}">Inicio</a><span>/</span><span>Tienda online</span></nav><section class="hub-hero"><div><p class="eyebrow">Elige tu forma de comprar</p><h1>Una idea,<br><span>su propio camino.</span></h1><p>Compra productos personalizados, pide materiales por medida o habla con el taller. Cada proyecto empieza en el lugar que mejor encaja.</p></div><div class="hub-side-note"><img src="../public/assets/nenufero-logo.png" alt=""><span>Diseño y producción<br>en Madrid</span></div></section><section class="hub-grid" aria-label="Experiencias de compra">${items.map(([url,title,copy,art],index)=>`<a class="hub-card" href="${url}"><div class="hub-card-art art-${art}"><span>${String(index+1).padStart(2,"0")}</span><b aria-hidden="true">${["N/","↗","M²","V/","PVC","⌁","✳"][index]}</b></div><div class="hub-card-copy"><p class="eyebrow">${index===6?"Te ayudamos":"Compra por categoría"}</p><h2>${title}</h2><p>${copy}</p><span class="hub-card-link">Explorar <b>↗</b></span></div></a>`).join("")}</section><section class="hub-contact"><div><p class="eyebrow">¿No sabes qué categoría elegir?</p><h2>Cuéntanos qué<br>quieres hacer.</h2></div><a class="button button-dark" href="proyecto-a-medida.html">Hablar con el taller <span>↗</span></a></section></main>`;
}

function renderExperience(data) {
  const quoteOnly = data.kind === "quote";
  const hasContactFields = data.fields.some((field) => field.name === "email");
  const quoteContact = quoteOnly && !hasContactFields ? `<div class="experience-fields contact-fields"><label class="experience-field">Tu nombre<input name="name" autocomplete="name" placeholder="¿Cómo te llamas?" required maxlength="120"></label><label class="experience-field">Tu teléfono<input name="phone" type="tel" autocomplete="tel" placeholder="Para poder responderte" required maxlength="40"></label><label class="experience-field experience-field-wide">Tu email<input name="email" type="email" autocomplete="email" placeholder="nombre@empresa.com" required maxlength="254"></label></div>` : "";
  const purchaseInfo = quoteOnly ? "Esta consulta se guarda en modo local y no se envía al taller." : "El precio de prueba se muestra solo para simular el recorrido. No es una tarifa real.";
  return `<main class="experience-page" id="contenido"><nav class="breadcrumbs"><a href="${HOME}">Inicio</a><span>/</span><a href="index.html">Tienda online</a><span>/</span><span>${esc(data.category)}</span></nav><section class="experience-hero"><div class="experience-copy"><p class="eyebrow"><span class="status-dot"></span>${esc(data.kicker)}</p><h1>${esc(data.heading).replace(/\n/g,"<br>")}</h1><p class="experience-intro">${esc(data.intro)}</p><div class="experience-benefits"><span>01&nbsp; Asesoramiento del taller</span><span>02&nbsp; Precio confirmado antes de producir</span></div></div><div class="experience-visual visual-${data.visual}"><div class="visual-orbit"></div><img src="../public/assets/nenufero-logo.png" alt=""><span class="visual-caption">${esc(data.visualLabel)}</span></div></section><section class="experience-workspace"><div class="workspace-heading"><div><p class="eyebrow">${quoteOnly?"Primer contacto":"Configura tu pedido"}</p><h2>${quoteOnly?"Cuéntanos lo esencial.":"Vamos paso a paso."}</h2></div><span class="demo-tag" data-mode-badge>SIMULACIÓN</span></div><p class="commerce-mode-note" data-mode-note>${esc(purchaseInfo)}</p><div class="workspace-grid"><form class="experience-form" data-experience-form data-kind="${quoteOnly?"quote":"purchase"}"><div class="form-step"><span class="step-number">01</span><div><h3>${quoteOnly?"Tu idea":"Elige opciones"}</h3><p>${esc(data.description)}</p></div></div><div class="experience-fields">${data.fields.map(fieldMarkup).join("")}${quoteOnly?`<label class="experience-field experience-field-wide">Cuéntanos tu idea<textarea name="details" rows="4" placeholder="Medidas, uso, cantidades o lo que te gustaría conseguir…" required maxlength="4000"></textarea></label>`:`<label class="experience-field experience-field-wide">Notas para el taller<textarea name="details" rows="3" placeholder="Color, acabado, instalación o fecha que tienes en mente…" maxlength="1000"></textarea></label>`}</div>${quoteContact}<label class="file-field"><span class="file-icon">↑</span><span><b>Sube una referencia</b><small>JPG, PNG, PDF, SVG, AI o EPS · Hasta 20 MB</small></span><input type="file" name="reference" accept="image/*,.pdf,.svg,.ai,.eps" data-reference-file><span class="file-preview" data-file-preview>Opcional</span></label>${quoteOnly?`<div class="form-step step-contact"><span class="step-number">02</span><div><h3>Revisamos contigo</h3><p>Guardaremos la solicitud de prueba con tus datos y referencia.</p></div></div>`:`<div class="price-preview" data-price-preview hidden><span data-price-label>Precio orientativo</span><strong data-price-value></strong><small data-price-unit></small></div>`}<p class="experience-error" data-form-error role="alert"></p><button class="button button-blue experience-submit" type="submit">${quoteOnly?"Guardar solicitud de prueba":"Añadir al carrito"}<span>↗</span></button><p class="form-disclaimer">${esc(data.promise)} ${purchaseInfo}</p></form><aside class="workspace-aside"><div class="aside-card"><span class="aside-index">N / ESTUDIO</span><h3>Una persona<br>al otro lado.</h3><p>El equipo te ayuda a elegir el material, revisar el diseño y confirmar el precio antes de fabricar.</p><a href="https://wa.me/${WHATSAPP}?text=${encodeURIComponent(`Hola, quiero consultar sobre ${data.category}.`)}" target="_blank" rel="noreferrer">Escribir por WhatsApp <span>↗</span></a></div><div class="aside-help"><p class="eyebrow">Prefieres email</p><a href="mailto:?subject=${encodeURIComponent(`Consulta para Nenufero · ${data.category}`)}">Contactar por email ↗</a><p>¿Quieres venir al taller? <a href="proyecto-a-medida.html">Solicita una visita.</a></p></div></aside></div></section><section class="experience-faq"><p class="eyebrow">Respuestas claras</p><div>${(journeyFaqs[pageId]||journeyFaqs.proyecto).map(([question,answer])=>`<details><summary>${esc(question)}<span>+</span></summary><p>${esc(answer)}</p></details>`).join("")}</div></section><section class="experience-next"><p class="eyebrow">También puedes explorar</p><div>${items.filter(([,title])=>title!==data.category).slice(0,3).map(([url,title])=>`<a href="${url}">${title}<span>↗</span></a>`).join("")}</div></section></main>`;
}
