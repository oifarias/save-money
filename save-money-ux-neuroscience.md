# Save Money — Análise de UX sob a ótica de Neurociência e Storytelling
> Diagnóstico das telas do MVP (V1.0) + plano de ação de melhorias de usabilidade e jornada

---

## 1. Por que olhar para neurociência e storytelling?

Decisões financeiras são, antes de tudo, **decisões emocionais racionalizadas a posteriori**. O cérebro processa dinheiro nas mesmas regiões que processam dor, medo e recompensa (ínsula, amígdala, núcleo accumbens). Um app de finanças pessoais não compete só com outros apps — compete com a ansiedade que o próprio tema "dinheiro" já desperta. Por isso, a forma como a interface "conta a história" da vida financeira do usuário importa tanto quanto a precisão dos números.

Antes de propor mudanças, revisei material recente sobre neurodesign e psicologia comportamental aplicada a produtos digitais. Os pontos que mais se aplicam ao Save Money:

- **Carga cognitiva e Lei de Hick**: quanto mais opções/elementos simultâneos, mais devagar e mais cansativa fica a decisão. O cérebro busca atalhos para "economizar energia" — interfaces previsíveis e com poucas escolhas por tela reduzem fadiga de decisão.
- **Dopamina e loops de recompensa**: o cérebro reforça comportamentos que geram pequenas recompensas previsíveis. Microinterações bem desenhadas (confirmações, animações, marcos) criam associações positivas e incentivam o retorno ao app — a base de qualquer hábito de "registrar gastos todo dia".
- **Regra do Pico-Fim (Peak-End Rule)**: as pessoas julgam uma experiência inteira pelo seu momento mais intenso (pico) e por como ela termina — não pela média. O fim de um fluxo (cadastro, lançamento, importação) tem peso desproporcional na lembrança que o usuário leva.
- **Modelo de Comportamento de Fogg (B = MAT)**: um comportamento só acontece quando Motivação, Capacidade (facilidade) e Gatilho (trigger) coincidem no tempo. Um app de controle financeiro depende de criar gatilhos certos no momento em que o usuário tem motivação e energia para agir.
- **Aversão à perda (Kahneman/Tversky)**: perdas doem ~2x mais que ganhos equivalentes trazem prazer. Comunicar "quanto você está deixando de economizar" tende a gerar mais ação do que "quanto você economizou".
- **Primeiras impressões em milissegundos**: o cérebro forma uma opinião sobre confiabilidade e clareza de uma tela em frações de segundo, antes mesmo da leitura consciente — consistência visual gera confiança instantânea.
- **Storytelling e ritmo narrativo**: dados isolados ("R$ 1.200 em Alimentação") são esquecidos; dados em forma de narrativa ("Alimentação foi o capítulo que mais cresceu na sua história financeira este mês") são lembrados e geram ação.

Fontes consultadas:
- [The Neuroscience of UX — UX Collective](https://uxdesign.cc/the-neuroscience-of-ux-542ba79e02f6)
- [Neurodesign: Using Neuroscience for Better UX Design — Bejamas/Dodonut](https://bejamas.com/blog/neurodesign-using-neuroscience-for-better-ux-design)
- [The importance of neuroscience in the UX process — UX Collective](https://uxdesign.cc/the-importance-of-neuroscience-in-the-user-experience-process-13a2d4fe5006)
- [Storytelling in UX: How to Design Engaging Narrative Experiences — Aguayo](https://aguayo.co/en/blog-aguayo-user-experience/storytelling-in-ux/)
- [Fogg Behavior Model: Motivation, Ability, and Prompts — Northbeam](https://www.northbeam.io/blog/fogg-behavior-model-motivation-ability-and-prompts)
- [Top 7 Psychology Principles for Better UI/UX Design — Index.dev](https://www.index.dev/blog/ui-ux-design-psychology-principles)
- [The Role of Behavioral Science in UX Design — inBeat Agency](https://inbeat.agency/blog/behavioral-science-in-ux-design)

---

## 2. O que já está bem resolvido (vale preservar)

Antes das críticas, é importante nomear o que a base atual já acerta — para não perder esses ganhos nas próximas iterações:

- **Consistência visual via CSS Variables e o componente `Card`**: gera previsibilidade, e previsibilidade gera confiança (o cérebro relaxa quando reconhece um padrão).
- **Personalização pelo primeiro nome** ("Olá, {Nome}" no header): nomes próprios ativam processamento autorreferencial e aumentam engajamento — pequeno detalhe, grande efeito.
- **Wizard de importação em etapas visíveis** (`upload → mapeamento → resultado`): aplica bem o *goal-gradient effect* — o usuário enxerga o caminho e sente que está avançando.
- **Estados vazios com ícone, título e texto explicativo** (`ComingSoon`, gráficos sem dados): evitam a sensação de "tela quebrada".
- **Cores com significado consistente** (verde para entradas/sucesso, vermelho para despesas/alerta): aproveita associações culturais já automatizadas no cérebro, reduzindo esforço de interpretação.

---

## 3. Análise por jornada

### 3.1 Cadastro → Login → Primeira tela (onboarding)

**O que acontece hoje:** o usuário preenche nome/e-mail/senha em `/cadastro`, recebe um toast de sucesso, é **redirecionado para `/login`** e precisa digitar tudo de novo para então cair num dashboard **vazio** (zero lançamentos, gráficos sem dados).

**Leitura sob neurociência:**
- Esse é o **pico emocional positivo** da jornada (decisão de "vou organizar minha vida financeira") — e o app responde pedindo para o usuário repetir trabalho. Pela Regra do Pico-Fim, esse atrito logo após o "sim" inicial pesa muito mais do que pareceria em uma planilha de esforço.
- O dashboard vazio é o equivalente a abrir um diário com páginas em branco: sem direção, a **motivação** (Fogg) despenca antes do primeiro **gatilho** de ação aparecer.

**Sugestões:**
1. **Login automático após cadastro** (`createUser` → `signIn` direto, sem reload de tela). Isso transforma o fim do cadastro no verdadeiro início da jornada, sem fricção.
2. **Onboarding guiado de 3 passos** já é citado na especificação (seção UX) e ainda não existe — é a oportunidade ideal para substituir o "dashboard vazio" por um **convite narrativo**: "Vamos escrever o primeiro capítulo da sua história financeira — registre seu primeiro lançamento".
3. **Empty state do dashboard com call-to-action direta** (não apenas gráficos vazios): um cartão central "Registre seu primeiro lançamento" com o botão já em destaque, reduzindo a distância entre intenção e ação (Capacidade, no modelo de Fogg).

---

### 3.2 Login / Recuperação de senha

**O que acontece hoje:** formulário limpo, centralizado, com toggle de tema visível — boa primeira impressão (consistente com o resto do app).

**Leitura sob neurociência:** a tela cumpre bem o teste dos "50 milissegundos" — limpa, sem ruído, com hierarquia clara. Pouco a melhorar estruturalmente.

**Sugestões (refino, não correção):**
4. **Microcopy mais acolhedor no cabeçalho** ("Bem-vindo de volta" já existe — ótimo). Could-have: variar a saudação conforme o horário do dia (bom dia/boa tarde/boa noite), reforçando a sensação de que o produto "está ali, com você", efeito sutil de personalização temporal.
5. Na recuperação de senha, deixar claro **quanto tempo o link dura** e **o que fazer se o e-mail não chegar** — incerteza é uma das maiores fontes de ansiedade (a amígdala reage a "não sei o que vai acontecer" quase como a uma ameaça).

---

### 3.3 Dashboard

**O que acontece hoje:** 4 cards de resumo → 2 gráficos (donut + barras) → painel de insights → lista dos 10 lançamentos recentes. Tudo visível em sequência vertical, sem hierarquia de prioridade emocional explícita.

**Leitura sob neurociência:**
- A ordem atual é **cronológica de implementação**, não **emocional**. O cérebro escaneia uma tela em padrão F/Z e forma julgamento pelo que vê primeiro. Hoje, o primeiro elemento é "Entradas do mês" — um dado neutro — quando o que mais importa emocionalmente para a maioria das pessoas é "**estou bem ou mal este mês?**" (saldo líquido).
- **Excesso de "vermelho" como cor padrão de despesa**: toda vez que o usuário abre o app, a cor associada a alerta/perigo domina boa parte da tela (ícones, valores, gráficos). Isso é **biologicamente ativador de estresse** — o vermelho aumenta o cortisol percebido mesmo em contextos neutros. Para uma categoria de gasto rotineiro (ex.: "Alimentação: R$ 850"), o vermelho comunica "perigo" quando deveria comunicar apenas "saída de caixa".
- O **painel de insights** está posicionado depois dos gráficos — mas é justamente ele que entrega a "história" e o "porquê". Sob a ótica de storytelling, ele deveria aparecer mais cedo, como um "resumo do capítulo", não como nota de rodapé.

**Sugestões:**
6. **Reordenar com "saldo" como herói emocional**: colocar o card de Saldo Líquido em destaque visual (maior, no topo ou centralizado), seguido de entradas/despesas/fixas como "coadjuvantes" — espelha como as pessoas realmente pensam ("no fim das contas, sobrou ou faltou?").
7. **Reduzir a saturação do vermelho para despesas neutras**: reservar o tom de alerta (`--color-danger`) para situações que exigem ação real (saldo negativo, estouro de orçamento, gasto muito acima da média) e usar uma cor neutra/azulada para despesas dentro do esperado. Isso evita "fadiga de alerta" — quando tudo é vermelho, nada parece urgente.
8. **Trazer 1 insight-resumo para o topo, em formato de manchete**: ex. um banner curto acima dos gráficos — "Este mês, Alimentação foi seu maior protagonista, com 32% dos seus gastos" — funcionando como *lead* de uma matéria, dando contexto antes dos números crus (ordem: contexto → dado → detalhe, que é como o cérebro retém histórias).
9. **Saudação dinâmica por horário do dia** ("Boa noite, Lucas — hora de revisar o dia?") cria um gatilho temporal natural (Fogg) alinhado ao momento em que as pessoas de fato revisam finanças (fim do dia/semana).

---

### 3.4 Lançamento manual (formulário)

**O que acontece hoje:** formulário com 9 campos visíveis simultaneamente (tipo, data, descrição, valor, conta, categoria + criação inline, despesa fixa, recorrência, hashtags).

**Leitura sob neurociência:**
- Pela **Lei de Hick**, cada campo adicional visível aumenta o tempo de decisão e a chance de abandono — especialmente em mobile, onde o app já prevê uso constante ("registrar na hora").
- Internamente, os campos têm prioridades muito diferentes: **tipo, valor e descrição** são essenciais e usados sempre; **conta, categoria, fixo, recorrência e hashtags** são "metadados" que enriquecem o registro, mas nem sempre são decididos no calor do momento (ex.: a pessoa está na fila do mercado).
- Cada campo extra exigido **antes de salvar** é uma barreira de "Capacidade" no modelo de Fogg — e pode ser o motivo de alguém desistir de registrar um gasto pequeno.

**Sugestões:**
10. **Modo rápido vs. modo completo**: abrir o formulário já mostrando só tipo + valor + descrição + botão "Salvar", com um link discreto "+ adicionar detalhes" que revela categoria, conta, recorrência, tags e fixo sob demanda (*progressive disclosure*). Detalhes podem ser preenchidos depois, na lista. Isso reduz o "custo de entrada" do hábito que o produto quer construir.
11. **Pré-seleção inteligente de categoria**: sugerir a categoria mais usada para descrições semelhantes já digitadas antes (ex.: "Uber" → Transporte). Pequenas sugestões corretas geram uma sensação de "o app me entende", reforçando o vínculo (efeito de reciprocidade/confiança).
12. **Feedback de conclusão mais "celebratório" para o primeiro lançamento e marcos** (5º, 50º, 100º lançamento): em vez de um toast padrão, uma microanimação ou mensagem diferenciada ("Primeiro capítulo registrado! 🎉") aciona o sistema de recompensa e ajuda a fixar o hábito nos primeiros dias — período crítico de adesão.

---

### 3.5 Importação via Excel

**O que acontece hoje:** fluxo em 3 passos com pré-visualização e validação linha a linha — já é um dos pontos mais bem resolvidos do produto do ponto de vista de clareza de progresso.

**Leitura sob neurociência:** o *goal-gradient effect* está bem aplicado (passos visíveis = sensação de avanço). A tabela de validação com status "OK"/erro por linha reduz a ansiedade da "caixa-preta" (o usuário vê exatamente o que vai acontecer antes de confirmar).

**Sugestões (refino):**
13. **Resumo "humano" antes de confirmar**: em vez de só "23 válida(s) · 2 com erro", complementar com uma frase de contexto: "Vamos importar 23 lançamentos somando R$ 4.350,00 para a conta Carteira principal". Números acompanhados de contexto narrativo são processados — e lembrados — com mais facilidade do que números isolados.
14. **Indicador visual de etapa (stepper) no topo do card**: hoje os passos são implícitos pela troca de conteúdo; um stepper visual (1 → 2 → 3, com o atual destacado) reforça o senso de progresso mesmo antes de ler o conteúdo.

---

### 3.6 Comparativo mês a mês

**O que acontece hoje:** seleção de meses por chips, filtro por tipo, gráfico de barras agrupadas, tabela com variação percentual e exportação.

**Leitura sob neurociência:**
- Comparações são **âncoras cognitivas poderosas** — o cérebro entende "subiu 40%" muito mais rápido do que "foi de R$500 para R$700". O produto já faz isso bem.
- Falta, porém, a camada de **interpretação emocional**: a tabela informa "o que" mudou, mas não "o que isso significa para a vida da pessoa".

**Sugestões:**
15. **Frase de leitura automática acima da tabela**: ex. "Comparado a {mês A}, você gastou {X}% a mais com Lazer e {Y}% a menos com Transporte — uma troca que pode valer a pena questionar." Transforma uma tabela fria em um parágrafo de "o que aconteceu na sua história financeira entre esses dois pontos no tempo".
16. **Permitir favoritar/repetir uma comparação** (ex.: "sempre comparar mês atual com o mesmo mês do ano anterior") — reduz a carga de decisão repetida (Lei de Hick) para quem usa o recurso com frequência.

---

### 3.7 Insights e Recomendações

**O que acontece hoje:** painel rico com ranking de crescimento, médias por grupo, sugestões de redução, ranking de hashtags e alerta de despesas fixas — tudo em formato de cards analíticos.

**Leitura sob neurociência:**
- Esta é a seção com **maior potencial de storytelling** do produto — é literalmente onde o app "interpreta" a vida financeira da pessoa — mas hoje está estruturada como um **relatório**, não como uma **narrativa**. Relatórios são lidos com o córtex pré-frontal (analítico, cansa rápido); narrativas são processadas com o sistema límbico (emocional, gera memória e ação).
- A "Regra do Pico-Fim" também vale aqui: a ordem dos cards determina qual insight fica na memória ao sair da tela.

**Sugestões:**
17. **Reescrever o insight de maior destaque como manchete narrativa, não como tabela**: ex., transformar "Lazer: R$50 → R$150 (+200%)" em "Lazer foi o grupo que mais cresceu nos últimos 3 meses — triplicou de tamanho na sua rotina. Vale entender o que mudou." — frases curtas, em tom de conversa, geram mais retenção e ação do que percentuais isolados.
18. **Aplicar aversão à perda na sugestão de redução**: em vez de apenas "reduza 10% e economize R$60", testar também o enquadramento de perda: "Mantendo o ritmo atual em Alimentação, você terá gasto R$ 7.200 a mais até o fim do ano do que no ano passado." Pesquisas em economia comportamental mostram que esse tipo de frase costuma gerar mais ação do que o enquadramento de ganho equivalente.
19. **Fechar a página com uma nota positiva (mesmo quando os números são ruins)**: pela Regra do Pico-Fim, terminar a leitura com algo como "Você está acompanhando seus gastos com mais atenção do que a média das pessoas que usam o Save Money — esse é o primeiro passo para qualquer mudança" cria uma sensação de progresso e aumenta a chance de o usuário voltar no dia seguinte.
20. **Adicionar pequenas ilustrações/ícones de "personagens" para cada grupo de gasto** recorrente no texto (ex.: o "vilão do mês", o "grupo que se comportou bem") — transforma categorias abstratas em elementos de enredo, mais fáceis de lembrar e comentar com outras pessoas (efeito de compartilhamento social).

---

### 3.8 Navegação, Header e elementos persistentes

**O que acontece hoje:** sidebar fixa (desktop), drawer (tablet), bottom nav (mobile); header com saudação, sino de notificações (sem função ainda), toggle de tema e menu de usuário.

**Leitura sob neurociência:**
- O **sino de notificações sem função** é um ponto de atrito silencioso: o cérebro registra elementos clicáveis e cria uma expectativa; quando ela não é correspondida (nada acontece ao clicar), gera uma microfrustração que, repetida, **corrói a confiança no produto inteiro** — mesmo que o resto funcione bem. É um "gatilho" (Fogg) sem capacidade de gerar comportamento, que ensina o cérebro a ignorá-lo.
- A navegação responsiva (sidebar/drawer/bottom nav) está consistente — isso é ótimo para "automatizar" o uso (o cérebro não precisa reaprender o produto em telas diferentes).

**Sugestões:**
21. **Decisão explícita sobre o sino**: ou (a) implementar uma versão mínima funcional (ex.: lembrete de "você ainda não lançou nada esta semana"), ou (b) ocultá-lo até que existam notificações reais. Um elemento de interface "morto" custa mais confiança do que a ausência dele.
22. **Indicador de streak/sequência de uso** (ex.: "Você registrou gastos 5 dias seguidos") no header ou dashboard — aplica diretamente o loop de hábito (gatilho visível → ação → recompensa visível), tática validada em apps de hábito (ex. apps de idiomas, fitness) e ainda não explorada aqui.

---

## 4. Tabela-resumo de oportunidades (priorização)

| # | Sugestão | Princípio aplicado | Esforço | Impacto esperado |
|---|---|---|---|---|
| 1 | Login automático após cadastro | Peak-End Rule, redução de fricção | Baixo | Alto |
| 3 | Empty state do dashboard com CTA de 1º lançamento | Fogg (Capacidade), Storytelling | Baixo | Alto |
| 6 | Saldo líquido como "herói" visual do dashboard | Hierarquia emocional, F-pattern | Baixo | Alto |
| 7 | Reduzir saturação de vermelho para despesas neutras | Psicologia das cores, fadiga de alerta | Baixo | Médio-alto |
| 10 | Formulário de lançamento em "modo rápido" + detalhes opcionais | Lei de Hick, Fogg (Capacidade) | Médio | Alto |
| 17 | Reescrever insights como manchetes narrativas | Storytelling, sistema límbico vs. córtex | Médio | Alto |
| 21 | Resolver o sino de notificações (implementar ou ocultar) | Confiança, expectativa vs. realidade | Baixo | Médio |
| 22 | Indicador de streak/sequência de uso | Loop de hábito, dopamina | Médio | Alto |
| 8 | Insight-manchete no topo do dashboard | Storytelling, ordem contexto→dado | Baixo | Médio |
| 2 | Onboarding guiado de 3 passos | Fogg (Motivação + Gatilho) | Médio-alto | Alto |
| 12 | Microinterações de marco (1º, 5º, 50º lançamento) | Dopamina, reforço positivo | Médio | Médio |
| 18 | Enquadramento de perda nas sugestões de redução | Aversão à perda (Kahneman) | Baixo | Médio |
| 19 | Fechar a página de Insights com nota positiva | Peak-End Rule | Baixo | Médio |
| 15 | Frase de leitura automática no comparativo | Storytelling, âncoras cognitivas | Baixo | Médio |
| 13 | Resumo humano na confirmação de importação | Storytelling, contexto→número | Baixo | Baixo-médio |

---

## 5. Plano de ação sugerido

A ideia é avançar em **ondas curtas**, cada uma fechando um ciclo perceptível de melhoria — o que também segue o princípio do *goal-gradient*: progresso visível gera mais progresso.

### Onda 1 — "Reduzir fricção de entrada" (alto impacto, baixo esforço — 1 a 2 sprints curtos)
- [ ] (1) Login automático após cadastro
- [ ] (3) Empty state do dashboard com call-to-action para o primeiro lançamento
- [ ] (21) Decidir o destino do sino de notificações (implementar versão mínima ou ocultar)
- [ ] (6) Reorganizar o dashboard com o saldo líquido em destaque visual

> Objetivo da onda: encurtar o caminho entre "criei minha conta" e "registrei meu primeiro gasto e entendi onde estou".

### Onda 2 — "Tornar o cotidiano mais leve" (reduz carga cognitiva no uso recorrente — 2 a 3 sprints)
- [ ] (10) Formulário de lançamento em modo rápido + "adicionar detalhes" opcional
- [ ] (7) Revisão da paleta para diferenciar "gasto normal" de "alerta real"
- [ ] (11) Sugestão automática de categoria a partir da descrição
- [ ] (22) Indicador de sequência/streak de uso

> Objetivo da onda: tornar o ato de registrar gastos tão rápido e indolor quanto possível — é o comportamento-base de todo o produto.

### Onda 3 — "Transformar dados em história" (eleva o produto de utilitário para companhia — 2 a 3 sprints)
- [ ] (8) Insight-manchete no topo do dashboard
- [ ] (17) Reescrita dos insights como manchetes narrativas (não tabelas)
- [ ] (15) Frase de leitura automática no comparativo
- [ ] (18) Enquadramento de perda nas sugestões de redução
- [ ] (19) Fechamento positivo na página de Insights
- [ ] (13) Resumo humano na confirmação de importação

> Objetivo da onda: fazer o usuário sentir que o app "entende" a vida dele — o salto de "ferramenta de planilha" para "parceiro de jornada financeira".

### Onda 4 — "Construir o hábito de longo prazo" (retenção — alinhado ao roadmap de V2)
- [ ] (2) Onboarding guiado de 3 passos (já citado na especificação, ainda pendente)
- [ ] (12) Microinterações de marco (1º, 5º, 50º lançamento; primeiro mês fechado)
- [ ] Conectar com os módulos de V2 que já têm DNA de loop de hábito (Metas, Pace, Notificações) — eles devem herdar os mesmos princípios de storytelling e reforço positivo definidos aqui, para manter consistência emocional em todo o produto.

---

## 6. Princípio orientador para o futuro

Sempre que uma nova tela ou funcionalidade for desenhada, vale fazer três perguntas simples antes de implementar:

1. **Carga**: o usuário precisa decidir/ler mais do que o estritamente necessário neste momento? (Lei de Hick)
2. **Emoção**: o que essa tela faz a pessoa *sentir* sobre o próprio dinheiro — e isso ajuda ou atrapalha o hábito que queremos construir? (Neurociência das emoções)
3. **História**: se essa tela fosse uma cena de uma história sobre a vida financeira do usuário, ela seria um momento de tensão, alívio, conquista ou tédio? E é isso que ela deveria ser? (Storytelling)

Esse pequeno checklist ajuda a manter o produto alinhado ao que a especificação já pede no nível de princípios ("interface moderna, sofisticada, sem estética genérica") — e estende esse cuidado da estética visual para a experiência emocional como um todo.
