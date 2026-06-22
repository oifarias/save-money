# Plano — Metas de Gastos (Orçamento por Grupo com onboarding de renda)

> Documento de planejamento. Nenhum código foi escrito ainda — este arquivo serve para alinhar a jornada, o modelo de dados e as fontes de referência antes de implementar.

## Contexto

O usuário pediu uma tela/jornada nova onde dá para definir metas de gasto por grupo, com um gráfico de porcentagem, e uma sugestão inicial de divisão de renda baseada em pesquisa de educação financeira.

O `save-money-product-spec.md` (linhas 247–253) já previa esse recurso como **Módulo 9 — Orçamento por Grupo (Budget Limit)**: usuário define um teto mensal por categoria, dashboard mostra % consumido, alerta em 80%/100%. O que falta nesse módulo, e que é o cerne do pedido atual, é o **onboarding de renda + sugestão de divisão (50/30/20)** antes do usuário preencher os valores por grupo. Este plano cobre exatamente essa lacuna, reaproveitando o modelo `Budget` que já existe no schema (não confundir com o modelo `Goal`, que é para metas de economia com prazo — Módulo 8, ex: "Reserva de emergência" — e não é o que está sendo pedido aqui).

## Pesquisa: método de divisão de renda

Referência adotada: **regra 50/30/20**, popularizada por Elizabeth Warren no livro *All Your Worth: The Ultimate Lifetime Money Plan*.

- 50% **Necessidades** — moradia, contas (água/luz/internet), alimentação, transporte, saúde
- 30% **Desejos** — lazer, assinaturas, estilo de vida, gastos não essenciais
- 20% **Prioridades financeiras** — poupança, investimentos, reserva de emergência, quitação de dívidas além do mínimo

Fontes consultadas (confiáveis, uma internacional e uma nacional, para validar que a regra é a mesma referência em ambos os mercados):

- [NerdWallet — 50/30/20 Budget Calculator](https://www.nerdwallet.com/finance/learn/nerdwallet-budget-calculator) (EUA, explica needs/wants/savings)
- [InfoMoney — Regra 50-30-20: como funciona o método para organizar suas finanças](https://www.infomoney.com.br/minhas-financas/regra-50-30-20-conheca-um-metodo-para-organizar-suas-financas/) (BR, cita a origem no livro de Elizabeth Warren e detalha as 3 categorias)
- [CNN Brasil — Saiba como usar a regra 50/30/20 para organizar o orçamento](https://www.cnnbrasil.com.br/branded-content/economia/negocios/saiba-como-usar-a-regra-50-30-20-para-organizar-o-orcamento/) (BR, reforço editorial independente)

A regra é deliberadamente simples (não exige levantamento financeiro complexo) e os percentuais são um ponto de partida ajustável — isso já é parte do discurso oficial do método nas três fontes, então a jornada deve deixar claro que é **sugestão**, não obrigação, e permitir editar os valores livremente no passo 3.

## O que já existe no projeto (reaproveitar)

- **Schema** (`prisma/schema.prisma`): modelo `Budget` (`userId`, `categoryId`, `month` no formato `"YYYY-MM"`, `limitAmount`), com `@@unique([userId, categoryId, month])` — já é exatamente "valor de meta por grupo por mês". Não precisa de migration para essa parte.
- **Categorias**: `src/lib/default-categories.ts` tem a lista padrão criada no cadastro (Alimentação, Transporte, Moradia, Saúde, Lazer, Educação, Assinaturas, Outros). A tela de metas trabalha sobre os grupos raiz (`Category` com `parentId: null`) que o usuário já tem.
- **Cálculo de totais por mês**: `src/lib/dashboard-data.ts` já tem o padrão de `startOfMonth`/`addMonths`/agregação de `Transaction` por mês — mesma lógica a reaproveitar para calcular a média de entradas dos últimos 3 meses.
- **Gráfico de % e barras de progresso**: `src/components/dashboard/category-donut-chart.tsx` (donut com Recharts) e `src/components/insights/insight-sections.tsx` → `ReductionSuggestionsCard` (barra horizontal com `width: %` e cor mudando perto do limite) já têm exatamente a linguagem visual que o gráfico de porcentagem desta tela deve seguir — reaproveitar os componentes, não recriar do zero.
- **Padrão de wizard multi-step**: `src/components/transactions/import-wizard.tsx` (estado `step: "upload" | "map" | "result"`) é o modelo de referência para a jornada de 3 passos desta tela (renda → sugestão → valores por grupo).
- **Navegação**: `src/components/layout/nav-items.ts` — adicionar item novo (ícone sugerido: `Target`, do `lucide-react`).

## O que falta criar

### Schema (1 migration nova)

Falta um lugar para guardar a renda mensal usada como base do cálculo — não existe hoje. Proposta: novo modelo `BudgetIncome`, paralelo ao `Budget`:

```prisma
model BudgetIncome {
  id        String   @id @default(cuid())
  userId    String
  month     String   // "YYYY-MM"
  amount    Float
  source    String   // "average_3_months" | "manual"
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, month])
  @@map("budget_incomes")
}
```

O campo `source` existe especificamente para a jornada poder deixar claro pro usuário se aquele valor foi calculado automaticamente ou informado por ele — é o requisito "deixar claro isso na jornada" do pedido.

### Jornada (4 passos)

**Passo 1 — Renda mensal**
- Servidor verifica se existem lançamentos `INCOME` em pelo menos 3 meses distintos dentre os últimos 3 meses corridos.
  - **Se sim**: calcula a média das entradas desses 3 meses, mostra o valor já preenchido com texto explícito — algo como *"Calculamos isso com a média das suas entradas dos últimos 3 meses (Mar/Abr/Mai): R$ X"* — com os 3 valores mensais visíveis (não só a média escondida), e permite o usuário ajustar manualmente antes de confirmar.
  - **Se não**: campo de input livre, com texto explicando o motivo — *"Você ainda não tem 3 meses de entradas registradas — informe sua renda mensal aproximada para começar"*.
- Ao confirmar, grava/atualiza `BudgetIncome` do mês atual com `source: "average_3_months"` ou `"manual"` (vira `"manual"` também se o usuário editar o valor calculado automaticamente).

**Passo 2 — Sugestão de divisão (50/30/20)**
- Mostra os 3 blocos (Necessidades / Desejos / Prioridades financeiras) com valor em R$ e link para a explicação do método (citar a fonte, ex. InfoMoney).
- Pede para o usuário **classificar os grupos que ele já tem** em "Necessidade" ou "Desejo" (não travar numa lista fixa — deixar ele decidir, já que o mesmo grupo pode ser essencial pra uma pessoa e não pra outra; ex.: Educação). Sugestão de classificação pré-marcada pra agilizar:
  - Necessidade (pré-marcado): Moradia, Alimentação, Transporte, Saúde
  - Desejo (pré-marcado): Lazer, Assinaturas, Educação, Outros
- Os 20% de "Prioridades financeiras" não são alocados em nenhum grupo de despesa — são o valor que deve **sobrar** (poupança/investimento), e isso deve ficar visível como referência no passo 3 e no gráfico final, não como uma categoria de gasto.

**Passo 3 — Valor por grupo**
- Lista os grupos classificados como Necessidade e Desejo, cada um com um campo de valor.
- Pré-preenchimento sugerido: se o usuário já tem histórico de gastos, distribuir os 50%/30% **proporcionalmente ao que ele já gasta hoje em cada grupo** (não em partes iguais) — mais realista que um split uniforme. Sem histórico, divide em partes iguais dentro do bloco.
- Mostra o total alocado vs. o valor do bloco (Necessidades/Desejos) com aviso (não bloqueio) se passar do sugerido.
- Ao salvar: upsert de um `Budget` por `(userId, categoryId, mês atual)`.

**Passo 4 — Tela "Metas de Gastos" (resultado / uso contínuo)**
- Vira a tela permanente, acessível pelo menu (depois da configuração inicial, abrir aqui direto em vez do wizard).
- Gráfico de porcentagem: donut mostrando a divisão Necessidades / Desejos / Poupança restante do mês atual (reaproveita `category-donut-chart.tsx`).
- Lista por grupo com barra de progresso "gasto atual / limite definido" em %, com destaque em 80% e 100% (reaproveita o padrão de `ReductionSuggestionsCard`), igual ao que o Módulo 9 do spec original já pedia.
- Botão para reabrir o wizard e recalcular (útil quando a renda mudar ou um novo mês começar).

### Arquivos a criar (visão de implementação futura, não escopo deste documento)

- `prisma/schema.prisma` — modelo `BudgetIncome` + migration.
- `src/lib/budget-data.ts` — `getIncomeBaseline`, `getSuggestedAllocation`, `getCategorySpendShare`, `getBudgetProgress`.
- `src/app/(app)/metas/page.tsx` — decide entre mostrar wizard (sem `Budget` do mês atual ainda) ou a tela de resultado.
- `src/app/(app)/metas/actions.ts` — `setIncomeBaselineAction`, `saveBudgetAllocationAction`.
- `src/components/goals/` — `income-step.tsx`, `allocation-suggestion-step.tsx`, `category-budget-step.tsx`, `budget-progress-chart.tsx`, `goals-wizard.tsx` (orquestrador, no padrão do `import-wizard.tsx`).
- `src/components/layout/nav-items.ts` — novo item `{ href: "/metas", label: "Metas", icon: Target }`.

## Decisões abertas (confirmar antes de implementar)

1. A classificação Necessidade/Desejo por grupo é editável pelo usuário (recomendado) ou fixa pelos nomes padrão?
2. O pré-preenchimento do passo 3 deve usar a média de gasto histórico por grupo (recomendado, mais realista) ou dividir em partes iguais sempre?
3. `Budget` é por mês (`month: "YYYY-MM"`) — a meta deve ser recriada todo mês (copiando o mês anterior como ponto de partida, já citado no Módulo 9 original) ou deve haver um modo "meta fixa" que se repete automaticamente sem o usuário precisar confirmar de novo?
