# 🏛️ Polis

**Polis** é uma plataforma de transparência e coerência ética projetada para aproximar cidadãos do legislativo brasileiro. O app utiliza inteligência artificial para monitorar as atividades de parlamentares, cruzando discursos e votações para garantir a integridade da representação política.

## 🚀 Funcionalidades Principais

- **🔔 Radar Ético**: Notificações em tempo real sobre incoerências detectadas pela IA.
- **📊 Fidelidade Partidária**: Acompanhe o alinhamento de cada deputado com as diretrizes de seu partido.
- **💰 Monitoramento de Gastos**: Visualização detalhada de despesas, categorizadas por mês e tipo.
- **🗳️ Histórico Legislativo**: Votos nominais, projetos e emendas parlamentares em um só lugar.
- **📈 Reputação e Ranking**: Integração com o Ranking dos Políticos para uma visão 360º da atuação pública.

## 🛠️ Tecnologias Utilizadas

- **Core**: React 19 + TypeScript
- **Build Tool**: Vite
- **Backend/DB**: Supabase (Realtime, Auth, Postgres)
- **AI/ML**: Google Gemini Pro (Análise de coerência e resumos legislativos)
- **Styling**: Vanilla CSS (Design Premium & Glassmorphism)
- **Mobile Prep**: Capacitor (Pronto para iOS/Android)

## 📡 Configuração de Ambiente

Para rodar localmente, crie um arquivo `.env.local` na raiz:

```env
VITE_SUPABASE_URL=sua_url
VITE_SUPABASE_ANON_KEY=sua_chave_publica
```

## 🛰️ Deploy

O projeto está configurado para deploy contínuo na **Vercel**. O arquivo `vercel.json` garante o roteamento correto para as páginas do perfil.

---
*Polis - A tecnologia a serviço da democracia.*
