const qrcode = require('qrcode-terminal');
const { Client } = require('whatsapp-web.js');
const fs = require('fs');

const client = new Client();
const delay = ms => new Promise(res => setTimeout(res, ms));

const userActivity = new Map();
const userState = new Map();
const userSubState = new Map();
const caminhoAvaliacoes = './avaliacoes.json';

// === Função para salvar avaliação ===
function salvarAvaliacao(user, nota) {
    const dataAtual = new Date().toISOString();
    const novaAvaliacao = { usuario: user, nota, data: dataAtual };

    let avaliacoes = [];
    if (fs.existsSync(caminhoAvaliacoes)) {
        const dados = fs.readFileSync(caminhoAvaliacoes);
        avaliacoes = JSON.parse(dados);
    }

    avaliacoes.push(novaAvaliacao);
    fs.writeFileSync(caminhoAvaliacoes, JSON.stringify(avaliacoes, null, 2));
}

// === QR Code e Inicialização ===
client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('Tudo certo! WhatsApp conectado.');
    setInterval(verificarInatividade, 60000);
});

client.initialize();

// === Controle de Atividade ===
function registrarAtividade(user) {
    userActivity.set(user, Date.now());
}

async function verificarInatividade() {   
    const agora = Date.now();
    for (const [user, timestamp] of userActivity.entries()) {
        const tempoInativo = agora - timestamp;

        if (tempoInativo >= 10 * 60000) {
            await client.sendMessage(user, 'Encerramos seu atendimento devido à inatividade. Caso precise de algo, digite "oi" para reiniciar.');
            await client.sendMessage(user, 'Antes de encerrar completamente, por favor, avalie o quanto o atendimento foi útil para você (responda com um número):\n\n1 - Muito útil\n2 - Útil\n3 - Pouco útil\n4 - Nada útil');
            userActivity.delete(user);
            userState.set(user, 'avaliacao');
        } else if (tempoInativo >= 1.5 * 60000 && tempoInativo < 2.5 * 60000) {
            await client.sendMessage(user, 'Ainda está por aqui? Se precisar de ajuda, estou à disposição.');
        }
    }
}

async function mostrarMenu(user) {
    const contact = await client.getContactById(user);
    const name = contact.pushname || 'Aluno(a)';
    const primeiroNome = name.split(" ")[0];

    
    await client.sendMessage(user,
        `Olá, ${primeiroNome}! 👋 Seja bem-vindo(a) ao atendimento virtual da Secretaria da Estácio Campus Barra Tom Jobim.

Nosso atendimento com os focais dos processos funciona de segunda à sexta, das 10h às 20h.

Selecione uma das opções abaixo para que possamos te auxiliar:

1 - Estágio
2 - ProUni / FIES
3 - Colação de Grau / Diplomas
4 - Declarações / Documentos
5 - Renovação de Matrícula
6 - Dúvidas Financeiras
7 - Dúvidas Acadêmicas
8 - Dúvidas sobre SIA / SAVA
9 - Outros`);
    userState.set(user, 'menu');
    userSubState.delete(user);
}

// === Lógica principal ===
client.on('message', async msg => {
    const texto = msg.body.trim();
    const chat = await msg.getChat();
    const user = msg.from;

    registrarAtividade(user);
    const estado = userState.get(user) || 'menu';
    const subestado = userSubState.get(user);

    // === ETAPA: AVALIAÇÃO ===
    if (estado === 'avaliacao') {
        if (["1", "2", "3", "4"].includes(texto)) {
            salvarAvaliacao(user, texto);
            await chat.sendStateTyping(); await delay(2000);
            await client.sendMessage(user, 'Agradecemos seu feedback! Atendimento encerrado. Quando precisar, só entrar em contato.');
            userState.delete(user);
            userSubState.delete(user);
            userActivity.delete(user);
        } else {
            await chat.sendStateTyping(); await delay(2000);
            await client.sendMessage(user, 'Por favor, responda com um número de 1 a 4 para avaliar o atendimento.');
        }
        return;
    }

    // === ETAPA: PÓS-ATENDIMENTO ===
    if (estado === 'pos-atendimento') {
        if (texto.toLowerCase() === 'sim') {
            await chat.sendStateTyping(); await delay(2000);
            await client.sendMessage(user, 'Perfeito! Retornando ao menu principal...');
            await delay(1000);
            await mostrarMenu(user);
        } else if (["não", "nao"].includes(texto.toLowerCase())) {
            userState.set(user, 'avaliacao');
            await chat.sendStateTyping(); await delay(2000);
            await client.sendMessage(user, 'Antes de encerrarmos, por favor, avalie o quanto o atendimento foi útil para você (responda com um número):\n\n1 - Muito útil\n2 - Útil\n3 - Pouco útil\n4 - Nada útil');
            userActivity.delete(user);

        } else {
            await chat.sendStateTyping(); await delay(2000);
            await client.sendMessage(user, 'Por favor, responda com "Sim" ou "Não". Você precisa de mais alguma coisa?');
        }
        return;
    }


    // === MENSAGENS FORA DE CONTEXTO ===
    if (!['menu', 'avaliacao', 'pos-atendimento'].includes(estado)) {
        const esperandoNumero = /^[1-9]$/.test(texto);

        if (!esperandoNumero) {
            if (subestado === 'outros') {
                await chat.sendStateTyping(); await delay(2000);
                await client.sendMessage(user, 'Desculpa não entendi. Escolha uma das opções abaixo:\n\n1 - Trancamento/Cancelamento de matrícula\n2 - Abrir uma reclamação\n3 - Transferências\n4 - Não achou o que procurava?\n5 - Voltar');
            } else if (subestado === 'transferencias') {
                await chat.sendStateTyping(); await delay(2000);
                await client.sendMessage(user, 'Desculpa não entendi. Escolha uma das opções abaixo:\n\n1 - Transferência Interna\n2 - Transferência Externa\n3 - Voltar');
            } else {
                await chat.sendStateTyping(); await delay(2000);
                await client.sendMessage(user, 'Desculpa não entendi, certifique-se de escolher uma opção válida para a etapa atual.');
            }
            return;
        }
    }


    // === SUBMENUS de "Outros" ===
    if (estado === 'menu' && subestado === 'outros') {
        switch (texto) {
            case '1':
                await chat.sendStateTyping(); await delay(2000);
                await client.sendMessage(user, "Para realizar o trancamento/ cancelamento de matrícula é necessario ligar para '4003-6767' e agendar a sua entrevista de trancamento (entrevistas de trancamento não podem ser agendadas para o mesmo dia.)");
                break;
            case '2':
                await chat.sendStateTyping(); await delay(2000);
                await client.sendMessage(user, 'Para realizar alguma reclamação sobre algum serviço específico favor envia-las para:https://wa.link/m2ajlx ');
                break;
            case '3':
                userSubState.set(user, 'transferencias');
                await chat.sendStateTyping(); await delay(2000);
                await client.sendMessage(user,
                    'Transferência selecionada. Escolha uma das opções abaixo:\n1 - Transferência Interna\n2 - Transferência Externa\n3 - Voltar');
                return;
            case '4':
                await chat.sendStateTyping(); await delay(2000);
                await client.sendMessage(user, 'Não achou o que procurava? entre em contato com um de nossos focais: https://wa.link/ptr6ue');
                break;
            case '5':
                await mostrarMenu(user);
                return;
            default:
                await chat.sendStateTyping(); await delay(2000);
                await client.sendMessage(user, 'Opção inválida. Por favor, escolha de 1 a 5.');
                return;
        }
        await chat.sendStateTyping(); await delay(2000);
        await client.sendMessage(user, 'Você precisa de mais alguma coisa? (Responda com "Sim" ou "Não")');
        userState.set(user, 'pos-atendimento');
        userSubState.delete(user);
        return;
    }
    // === SUBMENU de Transferências ===
    if (estado === 'menu' && subestado === 'transferencias') {
        switch (texto) {
            case '1':
                await chat.sendStateTyping(); await delay(2000);
                await client.sendMessage(user, 'Transferência Interna:\nPara realizar a transferência interna entre Campus da Estácio, acesse o SIA, pelo site ou pelo APP Aluno, (atendimento/requerimento/requerimento novo) e escolha a opção desejada, ou faça um atendimento presencial na Secretaria do Campus de destino.')

                break;
            case '2':
                await chat.sendStateTyping(); await delay(2000);
                await client.sendMessage(user, 'Transferência Externa:\nPara transferência externa providenciar na sua instituição de ensino O Plano de Ensino (ementa), o histórico acadêmico com status de Trancado ou Transferência, RG, CPF e Certificado do ensino Médio');
                break;
            case '3':
                userSubState.set(user, 'outros');
                await chat.sendStateTyping(); await delay(2000);
                await client.sendMessage(user,
                    'Você está de volta ao menu "Outros". Escolha uma das opções:\n\n1 - Trancamento/Cancelamento de matrícula\n2 - Abrir uma reclamação\n3 - Transferências\n4 - Não achou o que procurava?\n5 - Voltar');
                return;
            default:
                await chat.sendStateTyping(); await delay(2000);
                await client.sendMessage(user, 'Opção inválida. Por favor, escolha de 1 a 3.');
                return;
        }
        await chat.sendStateTyping(); await delay(2000);
        await client.sendMessage(user, 'Você precisa de mais alguma coisa? (Responda com "Sim" ou "Não")');
        userState.set(user, 'pos-atendimento');
        userSubState.delete(user);
        return;
    }

    // === SUBMENU de Colação/Diplomas ===
    if (estado === 'menu' && subestado === 'colacao_diplomas') {
        switch (texto) {

            case '1':
                await chat.sendStateTyping(); await delay(2000);
                await client.sendMessage(user, '🎓 Colação -\nColação de Grau Oficial: É realizada de forma automática no Portal do Aluno após a conclusão de todas as disciplinas, horas de atividades complementar e aprovação de documentos obrigatórios para a Colação.');
                await chat.sendStateTyping(); await delay(3000);
                await client.sendMessage(user, 'Solenidade Festiva: \nRealizada em parceria com a promove, verificar pacotes em: https://grupopromove.com.br/');
                await chat.sendStateTyping(); await delay(4000);
                await client.sendMessage(user, 'Colação de Grau Antecipada: \nColação excepcional, solicitada antes da Colação de Grau Oficial em casos de aprovação em concurso público ou oferta de emprego imediata. Para solicitar esta colação compareça na Secretaria para abertura de requerimento.');
                await chat.sendStateTyping(); await delay(5000);
                await client.sendMessage(user, 'Ainda ficou com dúvidas? Entre em contato com o focal: https://wa.link/o828yl');
                break;
            case '2':
                userSubState.set(user, 'diplomas');
                await chat.sendStateTyping(); await delay(2000);
                await client.sendMessage(user,
                    'Diplomas selecionado. Escolha uma das opções abaixo:\n\n1 - Diplomas Graduação\n2 - Diplomas Pós-graduação\n3 - Diplomas Pronatec\n4 - Diplomas Curso Técnico\n5 - Voltar ');
                return;
            case '3':
                await mostrarMenu(user);
                return;
            default:
                await chat.sendStateTyping(); await delay(2000);
                await client.sendMessage(user, 'Opção inválida. Por favor, escolha de 1 a 3.');
                return;
        }
        await chat.sendStateTyping(); await delay(2000);
        await client.sendMessage(user, 'Você precisa de mais alguma coisa? (Responda com "Sim" ou "Não")');
        userState.set(user, 'pos-atendimento');
        userSubState.delete(user);
        return;
    }

    // === SUBMENU de Diplomas ===
    if (estado === 'menu' && subestado === 'diplomas') {
        switch (texto) {
            case '1':
                await chat.sendStateTyping(); await delay(2000);
                await client.sendMessage(user, 'Diplomas Graduação / Graduação Tecnológica:\nProcessado de forma automática e digital em até 60 dias úteis após Colação de Grau. Será enviado para seu e-mail e disponibilizado no Portal do Aluno.');
                break;
            case '2':
                await chat.sendStateTyping(); await delay(2000);
                await client.sendMessage(user, 'Diploma Pós Graduação: \nProcessado em até 60 dias úteis após conclusão do curso (todos documentos devem estar aprovados para emissão do mesmo). Retirada de documento físico na Secretaria.');
                break;
            case '3':
                await chat.sendStateTyping(); await delay(2000);
                await client.sendMessage(user, 'Diplomas Pronatec: \nSolicitar emissão em atendimento presencial na Secretaria.');
                break;
            case '4':
                await chat.sendStateTyping(); await delay(2000);
                await client.sendMessage(user, 'Diplomas Curso Técnico: \nComparecer a Secretaria com: Identidade, CPF, Comprovante de conclusão do ensino médio(Diploma ou certificado frente e verso e Histórico Escolar) Certidão de Nascimento ou Casamento. Para realizar a emissão do mesmo');
                break;
            case '5':
                userSubState.set(user, 'colacao_diplomas');
                await chat.sendStateTyping(); await delay(2000);
                await client.sendMessage(user,
                    'Você voltou para "Colação de Grau / Diplomas". Escolha:\n\n1 - Colação de Grau\n2 - Diplomas\n3 - Voltar');
                return;
            default:
                await chat.sendStateTyping(); await delay(2000);
                await client.sendMessage(user, 'Opção inválida. Por favor, escolha de 1 a 5.');
                return;
        }
        await chat.sendStateTyping(); await delay(2000);
        await client.sendMessage(user, 'Você precisa de mais alguma coisa? (Responda com "Sim" ou "Não")');
        userState.set(user, 'pos-atendimento');
        userSubState.delete(user);
        return;
    }


    // === Mensagens como "oi", "olá", etc. ===
    if (texto.match(/^(menu|oi|olá|ola|bom dia|boa tarde|boa noite)$/i)) {
        const estadoAtual = userState.get(user);
        const subestadoAtual = userSubState.get(user);

        if (!estadoAtual) {
            await mostrarMenu(user);
            return;
        }

        if (subestadoAtual === 'outros') {
            await chat.sendStateTyping(); await delay(2000);
            await client.sendMessage(user,
                'Você está em "Outros". Escolha uma das opções:\n\n1 - Trancamento/Cancelamento de matrícula\n2 - Abrir uma reclamação\n3 - Transferências\n4 - Não achou o que procurava?\n5 - Voltar');
        } else if (subestadoAtual === 'transferencias') {
            await chat.sendStateTyping(); await delay(2000);
            await client.sendMessage(user,
                'Você está em "Transferências". Escolha:\n\n1 - Transferência Interna\n2 - Transferência Externa\n3 - Voltar');
        } else if (estadoAtual === 'avaliacao') {
            await chat.sendStateTyping(); await delay(2000);
            await client.sendMessage(user, 'Por favor, responda com um número de 1 a 4 para avaliar o atendimento.');
        } else if (estadoAtual === 'pos-atendimento') {
            await chat.sendStateTyping(); await delay(2000);
            await client.sendMessage(user, 'Você precisa de mais alguma coisa? (Responda com "Sim" ou "Não")');
        } else {
            await chat.sendStateTyping(); await delay(2000);
            await client.sendMessage(user, 'Desculpa não entendi. Escolha uma das opções válidas para continuar.');
        }
        return;
    }


    // === MENU PRINCIPAL: Ações ===
    if (estado === 'menu' && !subestado) {

        switch (texto) {
            case '1':
                await chat.sendStateTyping(); await delay(2000);
                await client.sendMessage(user, '📘 Estágio - Instruções iniciais: \n1. Estágio Obrigatório: Disciplina obrigatória de acordo com a sua estrutura curricular do seu curso. Este estágio é realizado no Campus ou em Empresas Externas (públicas ou privadas)\n2. Estágio Não Obrigatório: Geralmente remunerado, realizado em Empresas Externas (públicas ou privadas).')
                await chat.sendStateTyping(); await delay(4000)
                await client.sendMessage(user, 'Em ambos os casos, você deve abrir o requerimento no Portal do Aluno através do caminho: requerimento > novo > estágio > estágio obrigatório ou estágio não obrigatório.   ')

                await chat.sendStateTyping(); await delay(6000);
                await client.sendMessage(user, 'Ainda esta com dúvidas?📲 Fale com o Focal: https://wa.link/j0f1fm');

                break;

            case '2': await
                chat.sendStateTyping(); await delay(2000);
                await client.sendMessage(user, '📚 PROUNI/FIES: fale com o focal da unidade:\nhttps://wa.link/w4towg');
                break;


            case '3':
                await chat.sendStateTyping(); await delay(2000);
                await client.sendMessage(user, 'OBS: Para verificar se possuem documentos pendentes verifique sua pasta de aluno no Portal do Aluno, no caminho: Pasta do Aluno > Meus Documentos > Documentos pessoais.')
                await chat.sendStateTyping(); await delay(2000)
                await client.sendMessage(user, 'Você escolheu "Colação de Grau / Diplomas". Selecione uma das opções abaixo:\n\n1 - Colação de Grau\n2 - Diplomas\n3 - Voltar');
                userSubState.set(user, 'colacao_diplomas');
                return;


            case '4':
                await chat.sendStateTyping(); await delay(2000);
                await client.sendMessage(user, '📄Declarações/Documentos: \nPara solicitação de declaração ou para postagens de documentos, acesse o SIA, pelo site ou pelo APP Aluno (atendimento/requerimento/requerimento novo) e escolha a opção desejada ');
                break;
            case '5':
                await chat.sendStateTyping(); await delay(2000);
                await client.sendMessage(user, '📆 Renovação de Matrícula: \nPara renovar acesse o Renova da Estácio https://renovaestacio.estacio.br/ ou faça um atendimento presencial na Secretaria do Campus.');
                break;
            case '6':
                await chat.sendStateTyping(); await delay(2000);
                await client.sendMessage(user, '💰 Dúvidas financeiras? Fale com o setor responsável: https://wa.me/8008806772');
                break;
            case '7':
                await chat.sendStateTyping(); await delay(2000);
                await client.sendMessage(user, '📘Questões acadêmicas: \nConsultar no seu SIA, as Informações Acadêmicas, ou fazer um atendimento presencial na Coordenação Acadêmica no Campus, acessar pela Secretaria.');
                break;
            case '8':
                await chat.sendStateTyping(); await delay(2000);
                await client.sendMessage(user, '💡Como acessar o SIA? Com o número de matrícula \n1. Acesse o endereço https://sia.estacio.br/sianet/logon.  \n2. Informe seu número de matrícula. Se você não souber ou tiver esquecido, clique na opção “Não sei ou esqueci minha Matrícula". \n3. Clique em "Esqueci minha senha/Cadastrar minha primeira senha";\n4. Siga as instruções que chegarão por e-mail.');
                await chat.sendStateTyping(); await delay(6000);
                await client.sendMessage(user, 'Veja como acessar o SIA apenas com seu e-mail de estudante:');
                await chat.sendStateTyping(); await delay(6000);
                await client.sendMessage(user, '1. Clique na opção “Entrar com o e-mail de estudante”.\n2. Informe o seu e-mail do estudante. Na Estácio, o e-mail do estudante tem o seguinte formato: número da matrícula + @alunos.estacio.br.\n3. Insira a sua senha padrão, que é composta pelos seis primeiros dígitos do seu CPF + @ + as duas primeiras letras do seu nome, sendo a primeira maiúscula e a segunda minúscula.');
                await chat.sendStateTyping(); await delay(8000);
                await delay(10000);
                await client.sendMessage(user, 'Como acessar a SAVA Estácio ?\nVocê consegue acessar a Sala de Aula Virtual por diferentes caminhos: Link direto e pelo App Minha Estácio.\n1. App Minha Estácio: pelo aplicativo, você consegue acessar diretamente suas disciplinas matriculadas.\n2. Link Direto: basta acessar o link estudante.estacio.br/login e entrar na sua conta usando seu E-mail de Estudante e senha padrão.Em todos os caminhos você deve utilizar seu E-mail Estudante e a senha padrão para acessar a Sala de Aula Virtual.');
                await chat.sendStateTyping(); await delay(8000);
                await delay(10000);
                await client.sendMessage(user, 'Lembrando que:\n\n> o e-mail de Estudante é formado pela #sua matricula# + @ + alunos.estacio.br \n> a senha padrão é composta pelos seis primeiros dígitos do seu CPF + @ + as duas primeiras letras do seu nome, sendo a primeira maiúscula e a segunda minúscula.\nEx: Caio, matrícula 20200000000, CPF 123.456.789-10. E-mail: 20200000000@alunos.estacio.br Senha: 123456@Ca');
                break;
            case '9':
                userSubState.set(user, 'outros');
                await chat.sendStateTyping(); await delay(2000);
                await client.sendMessage(user,
                    '🔍 Você escolheu "Outros". Selecione uma das opções abaixo:\n\n' +
                    '1 - Trancamento/Cancelamento de matrícula\n' +
                    '2 - Abrir uma reclamação\n' +
                    '3 - Transferências\n' +
                    '4 - Não achou o que procurava?\n' +
                    '5 - Voltar');
                return;
            default:
                await chat.sendStateTyping(); await delay(2000);
                await client.sendMessage(user, 'Desculpe, essa opção não é válida. Por favor, escolha um número de 1 a 9.');
                return;
        }

         await chat.sendStateTyping(); await delay(4000);
        await client.sendMessage(user, 'Você precisa de mais alguma coisa? (Responda com "Sim" ou "Não")');
        userState.set(user, 'pos-atendimento');
    }
    // === Qualquer outra mensagem fora de fluxo (antes ou depois do atendimento) ===
    if (!userState.has(user)) {
        await mostrarMenu(user);
        return;
    }
});
