# 🤖 Chatbot Estácio - Secretaria Acadêmica (Campus Barra Tom Jobim)

Este projeto implementa um chatbot de atendimento virtual para a Secretaria Acadêmica da Estácio - Campus Barra Tom Jobim. O objetivo é fornecer um canal rápido e eficiente de atendimento via WhatsApp, utilizando a biblioteca `whatsapp-web.js`.

## 📌 Funcionalidades

- Menu principal com 9 opções de atendimento
- Submenus (ex: Diplomas, Transferências)
- Redirecionamento do atendimento para os focais responsáveis por cada área
- Opção "Voltar" em todos os menus
- Avaliação pós-atendimento (armazenada em `avaliacoes.json`)
- Verificação de inatividade (encerra após 10 minutos)
- Mensagem de boas-vindas em qualquer primeiro contato
- Tratamento de mensagens fora de contexto

## 🛠️ Tecnologias

- Node.js  
- whatsapp-web.js  
- JavaScript  
- fs (manipulação de arquivos)
