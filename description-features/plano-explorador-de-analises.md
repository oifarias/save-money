# Explorador de Análises

## Visão geral

Tela interativa de análise financeira acessível a partir do card "Gastos por grupo" do dashboard (e diretamente via `/analise`). Permite ao usuário combinar múltiplos filtros, escolher entre diferentes tipos de gráficos e salvar ou compartilhar qualquer configuração como uma **visualização nomeada** — parecido com uma "view" de BI, mas simples e integrada ao produto.

O objetivo é que o usuário passe de _"qual grupo gastei mais esse mês?"_ para _"como meus gastos com Alimentação + Transporte evoluíram nos últimos 6 meses por tag?"_ sem precisar exportar planilhas.

---

## Fluxo de entrada

```
Dashboard (card Gastos por grupo)
        │
        ▼
  /analise (tela de entrada)
        │
        ├─ Sem visualizações salvas → abre o Explorer direto (tela vazia + filtros)
        │
        └─ Com visualizações salvas → Gallery screen
                │
                ├─ [Criar nova análise] → Explorer vazio
                └─ [Abrir] em card salvo → Explorer com filtros pré-carregados
```

---

## Tela de entrada — Gallery

Exibida apenas quando o usuário já tem pelo menos uma visualização salva. Layout em grid de cards, similar à tela de grupos.

Cada card da gallery mostra:
- Nome da visualização
- Miniatura do tipo de gráfico (ícone)
- Resumo dos filtros ativos (ex.: "Alimentação · Transporte · Jan–Jun 2026")
- Data de criação / última abertura
- Botões: **Abrir**, **Compartilhar**, **Excluir**
- Badge "Compartilhado" se o link público estiver ativo

CTA principal no topo: **"+ Criar nova análise"**

---

## Tela principal — Explorer

### Layout

```
┌──────────────────────────────────────────────────────┐
│  [← Minhas análises]    Análise personalizada   [💾 Salvar]  [🔗 Compartilhar]
├──────────────────────────────────────────────────────┤
│  PAINEL DE FILTROS (sempre visível, colapsável)      │
│  Grupos · Subgrupos · Tags · Tipo · Período · Valor  │
├──────────────────────────────────────────────────────┤
│  SELETOR DE GRÁFICO (abas ou carrossel horizontal)   │
│  [Barra] [Barra horiz.] [Linha] [Área] [Pizza/Donut] │
│  [Barra empilhada] [Cascata] [Mapa de calor]         │
├──────────────────────────────────────────────────────┤
│                                                      │
│            ÁREA DO GRÁFICO (ocupa ~60% da tela)      │
│                                                      │
├──────────────────────────────────────────────────────┤
│  OPÇÕES DE EXIBIÇÃO (collapse opcional)              │
│  Agrupar por: [Grupo] [Subgrupo] [Tag] [Mês] [Semana]│
│  Exibir valores no gráfico · Legenda · Escala        │
└──────────────────────────────────────────────────────┘
```

---

## Filtros disponíveis

| Filtro | Tipo de seleção | Observação |
|--------|-----------------|------------|
| Grupos (categorias) | Multi-select com chips | Ao selecionar um grupo, subgrupos disponíveis atualizam |
| Subgrupos | Multi-select dependente dos grupos selecionados | Disabled se nenhum grupo for selecionado |
| Tags | Multi-select com chips | Independente dos grupos |
| Tipo | Toggle: Despesa / Entrada / Ambos | |
| Período | Preset (30d, 3m, 6m, 12m, este ano, tudo) + intervalo customizado | |
| Intervalo de datas | Date range picker (data início + data fim) | Substitui período quando preenchido |
| Meses específicos | Seleção múltipla de mês/ano | Para comparação entre meses não contíguos |
| Fixa / Variável | Toggle opcional | |
| Valor (range) | Min e max | |

**Comportamento de filtros combinados:** todos são aditivos (AND). Seleção vazia em um filtro = sem restrição para aquele campo.

---

## Tipos de gráfico

### 1. Barra vertical
Ideal para comparar grupos em um único período.
- Eixo X: grupos/tags/subgrupos
- Eixo Y: valor (R$)
- Cores: paleta por grupo (igual ao dashboard)

### 2. Barra horizontal
Melhor quando há muitos grupos ou nomes longos.
- Mesmo dado da barra vertical, rotacionado
- Útil para ranking de gastos

### 3. Linha
Ideal para evolução temporal.
- Eixo X: tempo (mês, semana, dia)
- Eixo Y: valor
- Uma linha por grupo/tag selecionado
- Útil para: "como Alimentação evoluiu em 12 meses?"

### 4. Área
Variação da linha com área preenchida.
- Empilhável (stacked area) ou sobreposta
- Destaca o total acumulado vs. composição

### 5. Pizza / Donut
Ideal para proporção de um único período.
- Cada fatia = um grupo/tag
- Donut mostra o total no centro
- Limitado a ~8 itens (os menores agrupados em "Outros")

### 6. Barra empilhada
Ideal para composição ao longo do tempo.
- Eixo X: meses
- Cada barra = soma total; subdivisões coloridas por grupo
- Útil para: "qual grupo pesa mais mês a mês?"

### 7. Cascata (Waterfall)
Ideal para entender o saldo: entradas − saídas por categoria.
- Barras positivas (Entradas) e negativas (Despesas)
- Barra final = saldo líquido
- Útil para visão de fluxo de caixa por grupo

### 8. Mapa de calor (Heatmap)
Visão matricial.
- Linhas: grupos ou tags
- Colunas: meses
- Cor da célula: intensidade do gasto (quanto mais escuro, maior o valor)
- Útil para identificar sazonalidade por grupo

---

## Opções de exibição

- **Agrupar por:** Grupo / Subgrupo / Tag / Mês / Semana / Dia
- **Exibir valores:** mostrar/ocultar rótulos de valor nas barras/fatias
- **Mostrar legenda:** sim/não
- **Escala do eixo Y:** automática / logarítmica / fixar máximo manualmente
- **Paleta de cores:** padrão (cores do sistema por grupo) / monocromático / gradiente

---

## Visualizações salvas

### O que é salvo

Uma **visualização** é um snapshot de toda a configuração do Explorer no momento do salvamento:

```json
{
  "name": "Alimentação vs Transporte 2026",
  "filters": {
    "categoryIds": ["cat_abc", "cat_xyz"],
    "subcategoryIds": [],
    "tagIds": ["tag_1"],
    "type": "EXPENSE",
    "dateFrom": "2026-01-01",
    "dateTo": "2026-06-30",
    "isFixed": null,
    "amountMin": null,
    "amountMax": null
  },
  "chartType": "stacked-bar",
  "groupBy": "month",
  "displayOpts": {
    "showValues": true,
    "showLegend": true,
    "yScale": "auto",
    "colorScheme": "default"
  }
}
```

### UX de salvamento

1. Usuário clica **"Salvar"**
2. Modal simples: campo de nome (obrigatório) + descrição opcional
3. Se já é uma visualização aberta (abriu da gallery e modificou): opções "Salvar alterações" e "Salvar como nova"
4. Após salvar: toast de confirmação + badge de nome aparece no header da tela

### Gerenciamento

- Acesso às visualizações salvas: tela de entrada (gallery) ou menu no header do Explorer
- Renomear, duplicar e excluir diretamente nos cards da gallery
- Sem limite de visualizações salvas (pelo menos na v1)

---

## Compartilhamento

Segue o mesmo padrão do **Dividir conta** (`SharedSplit`): token único gerado no backend, rota pública sem autenticação.

### Fluxo

1. Usuário clica **"Compartilhar"** no Explorer ou no card da gallery
2. Modal abre com duas opções:
   - **"Gerar link público"** (se ainda não gerado)
   - **"Copiar link"** (se já existe)
3. Link gerado: `save-money.app/analise/publica/[token]`
4. Opção de **revogar** o link (torna o token inativo, gera um novo se quiser compartilhar de novo)
5. O link pode ser compartilhado via botão de cópia + botão de WhatsApp (já existe no padrão de split)

### Tela pública `/analise/publica/[token]`

- Sem autenticação, sem sidebar
- Layout limpo: nome da visualização no topo, gráfico em tela cheia
- Read-only: sem filtros editáveis, sem botões de salvar
- Badge "Criado por [nome do usuário]" + data de geração
- Botão **"Criar minha própria análise"** → CTA para cadastro/login
- Se o token for inválido ou revogado: página de erro amigável

### O que é compartilhado

O link compartilhado carrega os **dados reais** do usuário calculados no momento do acesso (não é um snapshot estático). Isso garante que o gráfico reflita os lançamentos atuais, mas significa que dados sensíveis ficam acessíveis a quem tiver o link.

> **Aviso ao usuário:** exibir no modal de compartilhamento "Qualquer pessoa com este link pode ver este gráfico com seus dados reais de lançamentos."

---

## Modelo de dados — Prisma

```prisma
model SavedVisualization {
  id          String   @id @default(cuid())
  userId      String
  name        String
  description String?
  filters     Json
  chartType   String
  groupBy     String
  displayOpts Json
  shareToken  String?  @unique
  shareActive Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("saved_visualizations")
}
```

---

## Rotas e arquitetura

| Rota | Auth | Descrição |
|------|------|-----------|
| `/analise` | ✅ | Gallery + entry screen |
| `/analise/nova` | ✅ | Explorer vazio |
| `/analise/[id]` | ✅ | Explorer com visualização salva carregada |
| `/analise/publica/[token]` | ❌ | Visualização pública compartilhada |
| `POST /api/visualizations` | ✅ | Criar visualização |
| `PATCH /api/visualizations/[id]` | ✅ | Atualizar |
| `DELETE /api/visualizations/[id]` | ✅ | Excluir |
| `POST /api/visualizations/[id]/share` | ✅ | Gerar/renovar token de compartilhamento |
| `DELETE /api/visualizations/[id]/share` | ✅ | Revogar compartilhamento |
| `GET /api/visualizations/publica/[token]` | ❌ | Carregar dados da visualização pública |

### Server Actions vs API Routes

- **Mutations** (criar, editar, excluir, share/unshare): Server Actions (`visualization-actions.ts`)
- **Leitura pública** (`/publica/[token]`): API Route (sem autenticação)
- **Dados do gráfico**: calculados no servidor (Server Component ou Server Action), nunca expondo queries brutas ao cliente

---

## Biblioteca de gráficos

Usar **Recharts** (já presente no projeto via dashboard). Os 8 tipos de gráfico mapeiam para:

| Tipo | Componente Recharts |
|------|---------------------|
| Barra vertical | `BarChart` + `Bar` |
| Barra horizontal | `BarChart` + `layout="vertical"` |
| Linha | `LineChart` + `Line` |
| Área | `AreaChart` + `Area` |
| Pizza | `PieChart` + `Pie` |
| Donut | `PieChart` + `Pie` + `innerRadius` |
| Barra empilhada | `BarChart` + `Bar stackId` |
| Mapa de calor | Implementação customizada com grid CSS + `Tooltip` |

O Waterfall (cascata) não existe nativamente no Recharts — implementar via `ComposedChart` com barras e offsets calculados.

---

## Casos extremos e regras

- **Sem dados para os filtros:** estado vazio com ilustração e sugestão de ampliar o período
- **Muitos grupos selecionados no gráfico de pizza:** agrupar automaticamente grupos com < 3% do total em "Outros"
- **Filtro de meses não contíguos no gráfico de linha:** conectar pontos mesmo com gap — adicionar nota visual nos intervalos sem dados
- **Visualização pública de token expirado/revogado:** página 404 customizada com CTA para login
- **Nome de visualização duplicado:** permitir duplicatas (usuário pode ter "Análise mensal" v1 e v2)
- **Filtro de grupo excluído após salvar:** ao carregar a visualização, ignorar silenciosamente IDs que não existem mais e exibir aviso inline "Alguns filtros salvos foram removidos pois os grupos correspondentes não existem mais"

---

## Plano de implementação

### Fase 1 — Fundação (sem persistência)
1. Rota `/analise/nova` com Explorer básico
2. Filtros multi-select (grupos, tags, tipo, período)
3. 3 tipos de gráfico: barra vertical, linha, pizza
4. Agrupamento por grupo e por mês
5. Link do card "Gastos por grupo" apontando para `/analise/nova`

### Fase 2 — Persistência
6. Migration Prisma + Server Actions de CRUD
7. Tela de gallery (`/analise`) com cards salvos
8. Salvar/carregar/renomear/excluir visualizações
9. Header do Explorer mostrando nome da visualização ativa

### Fase 3 — Gráficos avançados
10. Adicionar barra horizontal, área, donut, barra empilhada
11. Opções de exibição (valores, legenda, escala)
12. Waterfall e heatmap

### Fase 4 — Compartilhamento
13. Migration para `shareToken` + `shareActive`
14. Modal de compartilhamento com geração de link
15. Rota pública `/analise/publica/[token]`
16. API Route pública para dados
17. Botão de revogação + avisos de privacidade

---

## Referências internas

- Padrão de compartilhamento: `model SharedSplit` em `prisma/schema.prisma`
- Padrão de filtros: `src/lib/transaction-filters.ts` + `src/lib/validations/transaction-filters.ts`
- Paleta de cores por grupo: dashboard existente
- Componente de gráfico: verificar `src/components/dashboard/` para reutilizar wrappers do Recharts já existentes
