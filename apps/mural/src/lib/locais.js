/**
 * Cidades (concelhos) e freguesias para o Publicar (2026-10, pedido:
 * "na hora de publicar, freguesia e cidade").
 *
 * Copiado de apps/pessoal/src/lib/contactos.js (FREGUESIAS_POR_CONCELHO,
 * 2026-10) — só os nomes, sem as coordenadas dos GDs. Cópia e não
 * import: cada app é um bundle próprio (CLAUDE.md raiz), e o Mural não
 * deve partir quando a Pessoal mexer na lista dela. Os 12 concelhos
 * onde há GDs; qualquer outro entra por "Outra cidade" (texto livre),
 * e o filtro "Onde" do mural cresce a partir do que os anúncios trazem
 * — nunca desta lista.
 *
 * `regiao` é a região antiga (Norte/Lisboa/Sines), deduzida da cidade
 * para o anúncio continuar a ter uma — functions/mural.js ainda a exige.
 */
export const CIDADES = {
  "Porto": { regiao: "norte", freguesias: ["Aldoar, Foz do Douro e Nevogilde", "Bonfim", "Campanhã", "Cedofeita, Santo Ildefonso, Sé, Miragaia, São Nicolau e Vitória", "Lordelo do Ouro e Massarelos", "Paranhos", "Ramalde"] },
  "Maia": { regiao: "norte", freguesias: ["Águas Santas", "Castêlo da Maia", "Cidade da Maia", "Folgosa", "Milheirós", "Moreira", "Nogueira e Silva Escura", "Pedrouços", "São Pedro Fins", "Vila Nova da Telha"] },
  "Matosinhos": { regiao: "norte", freguesias: ["Custoias", "Guifões", "Lavra", "Leça da Palmeira", "Leça do Balio", "Matosinhos", "Perafita", "Santa Cruz do Bispo", "São Mamede de Infesta", "Senhora da Hora"] },
  "Vila Nova de Gaia": { regiao: "norte", freguesias: ["Arcozelo", "Avintes", "Canelas", "Canidelo", "Grijó e Sermonde", "Gulpilhares e Valadares", "Madalena", "Mafamude e Vilar do Paraíso", "Oliveira do Douro", "Pedroso e Seixezelo", "Sandim, Olival, Lever e Crestuma", "Santa Marinha e São Pedro da Afurada", "São Félix da Marinha", "Serzedo e Perosinho", "Vilar de Andorinho"] },
  "Gondomar": { regiao: "norte", freguesias: ["Baguim do Monte", "Fânzeres e São Pedro da Cova", "Foz do Sousa e Covelo", "Gondomar (São Cosme), Valbom e Jovim", "Lomba", "Melres e Medas", "Rio Tinto"] },
  "Valongo": { regiao: "norte", freguesias: ["Alfena", "Campo", "Ermesinde", "Sobrado", "Valongo"] },
  "Póvoa de Varzim": { regiao: "norte", freguesias: ["Aguçadoura", "Amorim", "Argivai", "Aver-o-Mar", "Balazar", "Beiriz", "Estela", "Laúndos", "Navais", "Póvoa de Varzim", "São Pedro de Rates", "Terroso"] },
  "Vila do Conde": { regiao: "norte", freguesias: ["Árvore", "Aveleda", "Azurara", "Bagunte, Ferreiró, Outeiro Maior e Parada", "Fajozes", "Fornelo e Vairão", "Gião", "Guilhabreu", "Junqueira", "Labruge", "Macieira da Maia", "Malta e Canidelo", "Mindelo", "Modivas", "Retorta e Tougues", "Rio Mau e Arcos", "Touguinha e Touguinhó", "Vila Chã", "Vila do Conde", "Vilar e Mosteiró", "Vilar do Pinheiro"] },
  "Barcelos": { regiao: "norte", freguesias: ["Abade de Neiva", "Aborim", "Adães", "Airó", "Aldreu", "Alheira e Igreja Nova", "Alvelos", "Alvito (São Pedro e São Martinho) e Couto", "Arcozelo", "Areias", "Areias de Vilar e Encourados", "Balugães", "Barcelinhos", "Barcelos, Vila Boa e Vila Frescainha (São Martinho e São Pedro)", "Barqueiros", "Cambeses", "Campo e Tamel (São Pedro Fins)", "Carapeços", "Carreira e Fonte Coberta", "Carvalhal", "Carvalhas", "Chorente, Góios, Courel, Pedra Furada e Gueral", "Cossourado", "Creixomil e Mariz", "Cristelo", "Durrães e Tregosa", "Fornelos", "Fragoso", "Galegos (Santa Maria)", "Galegos (São Martinho)", "Gamil e Midões", "Gilmonde", "Lama", "Lijó", "Macieira de Rates", "Manhente", "Martim", "Milhazes, Vilar de Figos e Faria", "Moure", "Negreiros e Chavão", "Oliveira", "Palme", "Panque", "Paradela", "Pereira", "Perelhal", "Pousa", "Quintiães e Aguiar", "Remelhe", "Roriz", "Santa Eugénia de Rio Covo", "Sequeade e Bastuço (São João e Santo Estêvão)", "Silva", "Silveiros e Rio Covo (Santa Eulália)", "Tamel (Santa Leocádia) e Vilar do Monte", "Tamel (São Veríssimo)", "Ucha", "Várzea", "Viatodos, Grimancelos e Minhotães e Monte de Fralães", "Vila Cova e Feitos", "Vila Seca"] },
  "São João da Madeira": { regiao: "norte", freguesias: ["São João da Madeira"] },
  "Lisboa": { regiao: "lisboa", freguesias: ["Ajuda", "Alcântara", "Alvalade", "Areeiro", "Arroios", "Avenidas Novas", "Beato", "Belém", "Benfica", "Campo de Ourique", "Campolide", "Carnide", "Estrela", "Lumiar", "Marvila", "Misericórdia", "Olivais", "Parque das Nações", "Penha de França", "Santa Clara", "Santa Maria Maior", "Santo António", "São Domingos de Benfica", "São Vicente"] },
  "Sines": { regiao: "sines", freguesias: ["Sines", "Porto Covo"] },
};
export const NOMES_CIDADES = Object.keys(CIDADES);
