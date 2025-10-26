document.addEventListener('DOMContentLoaded', () => {

    // --- Desbloqueio de Áudio (Autoplay Policy) ---
    let audioContext;
    let audioUnlocked = false;

    function initAudio() {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioContext.state === "suspended") {
            audioContext.resume();
        }
        audioUnlocked = true;
        console.log("🔊 AudioContext desbloqueado");
    }



    // --- MODO DE DEBUG ---
    // Defina como 'true' para ver as caixas de colisão e coordenadas
    const DEBUG_MODE = true;
    // -------------------------

    // ---  CONFIGURAÇÕES E CONSTANTES ---
    const GAME_WIDTH = 1280;
    const GAME_HEIGHT = 720;
    const LIBRARY_PLAYER_SCALE = 1.5;

    // ---  REFERÊNCIAS AOS ELEMENTOS HTML ---
    const startScreen = document.getElementById('start-screen');
    const canvas = document.getElementById('gameCanvas');
    canvas.width = GAME_WIDTH;
    canvas.height = GAME_HEIGHT;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    canvas.style.imageRendering = 'pixelated';

    const joystickContainer = document.getElementById('joystick-container');
    const joystickStick = document.getElementById('joystick-stick');
    const actionButton = document.getElementById('action-button');

    // --- SISTEMA DE ÁUDIO GLOBAL ---
    let reverbNode = null;

    // Pré-carrega e configura o reverb da livraria
    async function carregarReverb() {
        try {
            const response = await fetch(SONS.reverb);
            const arrayBuffer = await response.arrayBuffer();
            const impulse = await audioContext.decodeAudioData(arrayBuffer);
            const convolver = audioContext.createConvolver();
            convolver.buffer = impulse;
            return convolver;
        } catch (err) {
            console.warn("Reverb não pôde ser carregado:", err);
            return null;
        }
    }

    carregarReverb().then(node => reverbNode = node);

    const SONS = {
        porta: "audio/porta.wav",
        passos:
            "audio/passosMadeira.mp3",
        digitar:
            "audio/digitando.mp3",
        paginas: "audio/pagina.mp3"
    };

    let somDigitacao = null;

    function iniciarSomDigitacaoGlobal() {
        if (!audioUnlocked) return;
        if (somDigitacao && !somDigitacao.audio.paused) return; // já tocando

        if (!somDigitacao) {
            const audio = new Audio(SONS.digitar);
            const track = audioContext.createMediaElementSource(audio);
            const gain = audioContext.createGain();
            gain.gain.value = 0;
            track.connect(gain).connect(audioContext.destination);
            somDigitacao = { audio, gain };
            audio.loop = true;
        }

        somDigitacao.audio.currentTime = 0;
        somDigitacao.audio.play();
        const now = audioContext.currentTime;
        somDigitacao.gain.gain.cancelScheduledValues(now);
        somDigitacao.gain.gain.linearRampToValueAtTime(0.25, now + 0.3);
    }

    function pararSomDigitacaoGlobal() {
        if (!somDigitacao) return;
        const now = audioContext.currentTime;
        somDigitacao.gain.gain.cancelScheduledValues(now);
        somDigitacao.gain.gain.setValueAtTime(somDigitacao.gain.gain.value, now);
        somDigitacao.gain.gain.linearRampToValueAtTime(0, now + 0.5);
        setTimeout(() => {
            if (somDigitacao && somDigitacao.audio) somDigitacao.audio.pause();
        }, 600);
    }

    // ===============================
    // 🌑 TRANSIÇÃO PARA A LIBRARY
    // ===============================


    function mostrarCenaComDialogo(imagemUrl, textoDialogo, callback = null) {
        isDialogOpen = true;
        initAudio();

        const canvasRect = canvas.getBoundingClientRect();

        const container = document.createElement('div');
        container.style.position = 'absolute';
        container.style.left = `${canvasRect.left}px`;
        container.style.top = `${canvasRect.top}px`;
        container.style.width = `${canvasRect.width}px`;
        container.style.height = `${canvasRect.height}px`;
        container.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.justifyContent = 'center';
        container.style.alignItems = 'center';
        container.style.zIndex = '9999';
        container.style.backdropFilter = 'blur(3px)';
        container.style.animation = 'fadeIn 0.6s ease';
        canvas.parentElement.appendChild(container);

        const imagem = document.createElement('img');
        imagem.src = imagemUrl;
        imagem.style.maxWidth = '80%';
        imagem.style.maxHeight = '60%';
        imagem.style.borderRadius = '14px';
        imagem.style.boxShadow = '0 0 25px rgba(0,0,0,0.9)';
        imagem.style.objectFit = 'contain';
        container.appendChild(imagem);

        const faixa = document.createElement('div');
        faixa.style.position = 'absolute';
        faixa.style.bottom = '0';
        faixa.style.left = '50%';
        faixa.style.transform = 'translateX(-50%)';
        faixa.style.width = '90%';
        faixa.style.padding = '25px';
        faixa.style.background = 'rgba(0, 60, 160, 0.8)';
        faixa.style.color = 'white';
        faixa.style.fontFamily = "'Press Start 2P', cursive";
        faixa.style.fontSize = '14px';
        faixa.style.textAlign = 'center';
        faixa.style.borderRadius = '12px 12px 0 0';
        faixa.style.boxShadow = '0 -2px 20px rgba(0,0,0,0.5)';
        faixa.style.minHeight = '80px';
        faixa.style.overflow = 'hidden';
        container.appendChild(faixa);

        let i = 0;
        function digitarTexto() {
            if (i === 0 && typeof iniciarSomDigitacaoGlobal === 'function') {
                iniciarSomDigitacaoGlobal();
            }

            if (i < textoDialogo.length) {
                faixa.innerText = textoDialogo.substring(0, i + 1);
                i++;
                setTimeout(digitarTexto, 40);
            } else {
                // Parar som de digitação ao finalizar
                if (typeof pararSomDigitacaoGlobal === 'function') {
                    pararSomDigitacaoGlobal();
                }

                faixa.innerText += "\n\n(Pressione Enter ou E para continuar)";
                document.addEventListener('dialog-closed', fechar, { once: true });
            }
        }

        function fechar() {
            container.style.animation = 'fadeOut 0.6s ease';
            setTimeout(() => {
                container.remove();
                isDialogOpen = false;
                console.log('[DIALOGO] Fechado via Enter/E.');
                if (callback) callback();
            }, 400);
        }

        digitarTexto();
    }

    function transicaoParaEgitoComCena() {
        console.log('[TRANSIÇÃO] Iniciando transição cinematográfica para o Egito...');
        isDialogOpen = true;

        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100vw';
        overlay.style.height = '100vh';
        overlay.style.background = 'black';
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity 1s ease';
        overlay.style.zIndex = '99999';
        document.body.appendChild(overlay);

        requestAnimationFrame(() => overlay.style.opacity = '1');

        setTimeout(() => {
            loadLevel('egypt');
            currentLevelId = 'egypt';
            console.log('[TRANSIÇÃO] Mapa do Egito carregado.');

            setTimeout(() => {
                overlay.style.opacity = '0';
                setTimeout(() => overlay.remove(), 800);
            }, 800);

            setTimeout(() => {
                mostrarCenaComDialogoCor(

                    'O que foi isso?! Parece que fui transportado para dentro do livro.',
                    'rgba(0, 60, 160, 0.8)',
                    () => {
                        iniciarTremorTela(800);
                        setTimeout(() => {
                            mostrarCenaComDialogoCor(

                                'Voz Misteriosa:\n“Encontre o tesouro perdido... e resgate o que foi uma vez esquecido.”',
                                'rgba(160, 0, 0, 0.8)', // Vermelho (voz misteriosa)
                                () => {
                                    // 🟦 Jogador responde
                                    setTimeout(() => {
                                        mostrarCenaComDialogoCor(
                                            'O que? Tesouro perdido? Onde eu vou encontrar isso?',
                                            'rgba(0, 60, 160, 0.8)', // Azul do jogador
                                            () => {
                                                console.log('[TRANSIÇÃO] Cena do Egito concluída.');
                                                isDialogOpen = false;
                                            }
                                        );
                                    }, 500);
                                }
                            );
                        }, 1800);
                    }, 1000);
            }
            )
        }
        )
    }

    function mostrarCenaComDialogoCor(imagemUrl, textoDialogo, corFaixa = 'rgba(0, 60, 160, 0.8)', callback = null) {
        isDialogOpen = true;

        const canvasRect = canvas.getBoundingClientRect();
        const container = document.createElement('div');
        container.style.position = 'absolute';
        container.style.left = `${canvasRect.left}px`;
        container.style.top = `${canvasRect.top}px`;
        container.style.width = `${canvasRect.width}px`;
        container.style.height = `${canvasRect.height}px`;
        container.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.justifyContent = 'center';
        container.style.alignItems = 'center';
        container.style.zIndex = '9999';
        container.style.backdropFilter = 'blur(3px)';
        canvas.parentElement.appendChild(container);

        const imagem = document.createElement('img');
        imagem.src = imagemUrl;
        imagem.style.maxWidth = '80%';
        imagem.style.maxHeight = '60%';
        imagem.style.borderRadius = '14px';
        imagem.style.boxShadow = '0 0 25px rgba(0,0,0,0.9)';
        imagem.style.objectFit = 'contain';
        container.appendChild(imagem);

        const faixa = document.createElement('div');
        faixa.style.position = 'absolute';
        faixa.style.bottom = '0';
        faixa.style.left = '50%';
        faixa.style.transform = 'translateX(-50%)';
        faixa.style.width = '90%';
        faixa.style.padding = '25px';
        faixa.style.background = corFaixa;
        faixa.style.color = 'white';
        faixa.style.fontFamily = "'Press Start 2P', cursive";
        faixa.style.fontSize = '14px';
        faixa.style.textAlign = 'center';
        faixa.style.borderRadius = '12px 12px 0 0';
        faixa.style.boxShadow = '0 -2px 20px rgba(0,0,0,0.5)';
        faixa.style.minHeight = '80px';
        container.appendChild(faixa);

        // Digitação com som
        let i = 0;
        function digitarTexto() {
            if (i === 0 && typeof iniciarSomDigitacaoGlobal === 'function') iniciarSomDigitacaoGlobal();
            if (i < textoDialogo.length) {
                faixa.innerText = textoDialogo.substring(0, i + 1);
                i++;
                setTimeout(digitarTexto, 40);
            } else {
                if (typeof pararSomDigitacaoGlobal === 'function') pararSomDigitacaoGlobal();
                faixa.innerText += "\n\n(Pressione Enter ou E para continuar)";
                document.addEventListener('dialog-closed', fechar, { once: true });
            }
        }

        function fechar() {
            container.remove();
            isDialogOpen = false;
            if (callback) callback();
        }

        digitarTexto();
    }

    function iniciarTremorTela(duracao = 800) {
        const canvasContainer = canvas.parentElement;
        let start = performance.now();

        function tremer(timestamp) {
            const elapsed = timestamp - start;
            const intensidade = Math.max(0, 8 - (elapsed / duracao) * 8);
            const x = (Math.random() - 0.5) * intensidade;
            const y = (Math.random() - 0.5) * intensidade;
            canvasContainer.style.transform = `translate(${x}px, ${y}px)`;

            if (elapsed < duracao) {
                requestAnimationFrame(tremer);
            } else {
                canvasContainer.style.transform = 'translate(0, 0)';
            }
        }

        requestAnimationFrame(tremer);
    }


    function tocarSom(caminho, volume = 1, loop = false, fade = true) {
        if (!audioUnlocked) return null;

        const audio = new Audio(caminho);
        audio.loop = loop;
        const track = audioContext.createMediaElementSource(audio);
        const gain = audioContext.createGain();
        gain.gain.value = 0;
        track.connect(gain).connect(audioContext.destination);

        if (fade) {
            gain.gain.linearRampToValueAtTime(volume, audioContext.currentTime + 0.25);
        } else {
            gain.gain.value = volume;
        }

        audio.play();

        if (fade) {
            audio.addEventListener("ended", () => {
                gain.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.5);
            });
        }

        return { audio, gain };
    }



    // --- CENAS E TRANSIÇÕES ---
    function transicaoParaLibrary(callback) {
        isDialogOpen = true;
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100vw';
        overlay.style.height = '100vh';
        overlay.style.background = 'black';
        overlay.style.opacity = '1';
        overlay.style.zIndex = '9999';
        overlay.style.transition = 'opacity 3s ease';
        document.body.appendChild(overlay);

        // 🔊 Som de porta único, sem loop
        tocarSom(SONS.porta, 0.7, false);

        if (typeof callback === 'function') callback();

        setTimeout(() => overlay.style.opacity = '0', 2000);

        setTimeout(() => {
            overlay.remove();
            mostrarDialogoInicialLibrary();
        }, 4000);
    }

    function mostrarDialogoInicialLibrary(onFinish = null) {
        const canvasRect = canvas.getBoundingClientRect();

        const container = document.createElement('div');
        container.style.position = 'absolute';
        container.style.left = `${canvasRect.left + canvasRect.width / 2}px`;
        container.style.top = `${canvasRect.top + canvasRect.height - 140}px`;
        container.style.transform = 'translateX(-50%)';
        container.style.width = `${canvasRect.width * 0.9}px`;
        container.style.padding = '25px';
        container.style.background = 'rgba(0, 60, 160, 0.8)';
        container.style.color = 'white';
        container.style.fontFamily = "'Press Start 2P', cursive";
        container.style.fontSize = '14px';
        container.style.textAlign = 'center';
        container.style.borderRadius = '12px 12px 0 0';
        container.style.boxShadow = '0 -2px 20px rgba(0,0,0,0.5)';
        container.style.zIndex = '9999';
        container.style.minHeight = '80px';
        container.style.transition = 'opacity 0.6s ease';
        container.style.opacity = '0';
        document.body.appendChild(container);

        requestAnimationFrame(() => container.style.opacity = '1');



        const texto = "Já fazia muito tempo que não vinha nesse lugar, está bem bagunçado... ";
        let i = 0;
        let digitarTimer = null;

        function digitarTexto() {
            if (i === 0) iniciarSomDigitacaoGlobal(); // inicia o som global

            if (i < texto.length) {
                container.innerText = texto.substring(0, i + 1);
                i++;
                digitarTimer = setTimeout(digitarTexto, 45);
            } else {
                pararSomDigitacaoGlobal();
                setTimeout(() => {
                    container.style.opacity = '0';
                    setTimeout(() => {
                        container.remove();
                        destacarLivroComLuz();
                        isDialogOpen = false;
                        if (typeof onFinish === "function") onFinish();
                    }, 600);
                }, 1500);
            }
        }

        digitarTexto();
    }

    function destacarLivroComLuz() {
        const brilho = document.createElement('div');
        brilho.style.position = 'absolute';
        brilho.style.width = '100px';
        brilho.style.height = '100px';
        brilho.style.borderRadius = '50%';
        brilho.style.background = 'radial-gradient(rgba(255,255,180,0.9), rgba(255,255,0,0))';
        brilho.style.pointerEvents = 'none';
        brilho.style.zIndex = '5000';
        brilho.style.animation = 'pulsarLuz 1.5s infinite ease-in-out';
        document.body.appendChild(brilho);

        const livroMundo = { x: 986, y: 261 }; // posição do livro no mapa

        function atualizarPosicao() {
            const canvasRect = canvas.getBoundingClientRect();
            const offsetX = (livroMundo.x - camera.x) * (canvasRect.width / canvas.width);
            const offsetY = (livroMundo.y - camera.y) * (canvasRect.height / canvas.height);

            brilho.style.left = `${canvasRect.left + offsetX - 50}px`;
            brilho.style.top = `${canvasRect.top + offsetY - 50}px`;

            requestAnimationFrame(atualizarPosicao);
        }

        atualizarPosicao();
    }

    // --- Animações CSS ---
    const estiloLuz = document.createElement('style');
    estiloLuz.innerHTML = `
@keyframes pulsarLuz {
  0% { transform: scale(1); opacity: 0.8; }
  50% { transform: scale(1.4); opacity: 1; }
  100% { transform: scale(1); opacity: 0.8; }
}`;
    document.head.appendChild(estiloLuz);



    // --- Animações fade ---
    const style = document.createElement('style');
    style.innerHTML = `
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }`;
    document.head.appendChild(style);


    // ---  CONSTANTES QUE DEPENDEM DO CANVAS --
    const CAMERA_BOX_WIDTH = canvas.width * 0.5;
    const CAMERA_BOX_HEIGHT = canvas.height * 0.5;

    // --- "Banco de Dados" dos Níveis ---
    const levels = {
        'library': {
            mapSrc: 'https://uploads.onecompiler.io/43rzumf93/44293xhug/biblioteca_map.png',
            mapWidth: 1280,
            mapHeight: 717,
            startPos: { x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2 },
            collisions: [
                { x: 0, y: 255, width: 590, height: 295 },// Esquerda
                { x: 0, y: 550, width: 1600, height: 170 },// Baixo
                { x: 1060, y: 255, width: 230, height: 295 },// Direita
                { x: 900, y: 255, width: 160, height: 80 },// Mesa S.D
                { x: 700, y: 255, width: 0, height: 25 },//
                { x: 590, y: 430, width: 470, height: 120 },// Mesa
                { x: 0, y: 0, width: 1600, height: 255 },// Cima
            ],
            // --- NOVO: Objetos Interativos ---
            interactables: [
                {
                    id: 'egypt_book', // Identificador único
                    x: 986,           // Posição X (AJUSTE ESTE VALOR)
                    y: 261,           // Posição Y (AJUSTE ESTE VALOR)
                    width: 35,        // Largura da caixa de interação (AJUSTE)
                    height: 27,       // Altura da caixa de interação (AJUSTE)
                    hasInteracted: false,
                    action: function () { // Função a ser executada na interação
                        const book = this;
                        if (!book || book.hasInteracted || isDialogOpen) return;

                        book.hasInteracted = true;
                        isDialogOpen = true;
                        tocarSom(SONS.paginas, 0.7, false);
                        console.log("📖 Interagiu com o Livro do Egito");

                        mostrarCenaComDialogo(
                            'img/livrobt.png',
                            'Parece ser um livro de história... Algumas páginas estão em branco. Isso é estranho...',
                            () => {
                                mostrarCenaComDialogo(
                                    'img/livrobt.png',
                                    '*De repente o livro te puxa até ele*',
                                    () => {
                                        console.log('[LIVRO] Jogador terminou o diálogo — carregando mapa do Egito...');

                                        // Garante que não há bloqueios antes do load
                                        isDialogOpen = false;
                                        isLoadingLevel = false;

                                        try {
                                            transicaoParaEgitoComCena();
                                        } catch (err) {
                                            console.error('[LIVRO] Falha ao carregar o Egito:', err);
                                        }
                                    }
                                );
                            }
                        )
                    }
                }

            ]
        },
        'egypt': {
            mapSrc: 'https://uploads.onecompiler.io/43rzumf93/44293xhug/megaegit_map.png',
            mapWidth: 1600, mapHeight: 896,
            startPos: { x: 409, y: 606 },
            hotspots: [
                { id: 'pyramid_main', x: 800, y: 350, name: 'Pirâmide Principal' },
                { id: 'statue_left', x: 250, y: 750, name: 'Estátua Antiga' },
                { id: 'statue_right', x: 1350, y: 750, name: 'Estátua Guardiã' }
            ],
            collisions: [
                { x: 367, y: 124, width: 175, height: 230 },// Lago foguete
                { x: 730, y: 115, width: 160, height: 165 },// Piramide
                { x: 1200, y: 0, width: 400, height: 260 }, { x: 1370, y: 260, width: 240, height: 80 }, // Monte SD
                { x: 1425, y: 540, width: 70, height: 147 }, { x: 1400, y: 570, width: 240, height: 100 }, { x: 1370, y: 590, width: 70, height: 52 }, { x: 1356, y: 609, width: 70, height: 22 }, { x: 1391, y: 642, width: 70, height: 22 },//
                { x: 1508, y: 670, width: 210, height: 230 },// estatua antiga
                { x: 1238, y: 680, width: 45, height: 150 }, { x: 1220, y: 700, width: 80, height: 100 }, { x: 1196, y: 717, width: 130, height: 80 }, { x: 1160, y: 736, width: 180, height: 25 }, { x: 1173, y: 761, width: 170, height: 20 }, { x: 1185, y: 778, width: 151, height: 20 }, { x: 1491, y: 812, width: 70, height: 110 }, { x: 1473, y: 827, width: 50, height: 100 }, { x: 1463, y: 841, width: 50, height: 100 }, { x: 1446, y: 856, width: 50, height: 100 }, { x: 1430, y: 868, width: 50, height: 100 },// Montes ED
                { x: 594, y: 600, width: 155, height: 300 }, { x: 749, y: 732, width: 120, height: 500 }, { x: 869, y: 767, width: 20, height: 150 }, { x: 888, y: 816, width: 26, height: 150 }, { x: 914, y: 835, width: 26, height: 150 },// IM
                { x: 0, y: 682, width: 594, height: 230 }, { x: 0, y: 622, width: 281, height: 60 }, { x: 466, y: 644, width: 150, height: 38 }, { x: 490, y: 516, width: 50, height: 48 }, { x: 490, y: 564, width: 30, height: 16 }, { x: 0, y: 494, width: 50, height: 140 }, { x: 0, y: 340, width: 61, height: 65 }, { x: 50, y: 548, width: 65, height: 100 }, { x: 115, y: 569, width: 15, height: 65 }, { x: 130, y: 591, width: 39, height: 35 },
                { x: 0, y: 0, width: 182, height: 190 }, { x: 182, y: 0, width: 60, height: 117 }, { x: 0, y: 190, width: 134, height: 140 }, { x: 0, y: 330, width: 90, height: 40 }, { x: 398, y: 479, width: 70, height: 10 }, { x: 398, y: 418, width: 70, height: 5 },// SP
                { x: 1093, y: 0, width: 109, height: 120 }, { x: 1120, y: 120, width: 100, height: 200 }, { x: 1085, y: 270, width: 100, height: 70 }, { x: 1020, y: 310, width: 165, height: 60 }, { x: 986, y: 344, width: 150, height: 60 }, { x: 952, y: 380, width: 144, height: 60 }, { x: 910, y: 410, width: 140, height: 60 }, { x: 851, y: 438, width: 170, height: 60 }, { x: 851, y: 497, width: 140, height: 90 }, { x: 707, y: 457, width: 63, height: 143 }, { x: 687, y: 477, width: 20, height: 39 }, { x: 662, y: 515, width: 45, height: 86 }, { x: 617, y: 538, width: 45, height: 63 }, { x: 603, y: 566, width: 30, height: 106 }, { x: 398, y: 489, width: 92, height: 80 }, { x: 451, y: 569, width: 39, height: 20 },// Rio
                { x: 1187, y: 485, width: 22, height: 25 }, { x: 1077, y: 622, width: 10, height: 20 }, { x: 1043, y: 194, width: 77, height: 17 }, //Pedras
                { x: 986, y: 128, width: 134, height: 50 }, { x: 1125, y: 598, width: 18, height: 45 }, { x: 1313, y: 512, width: 22, height: 52 }, { x: 1235, y: 427, width: 1, height: 30 }, { x: 1290, y: 608, width: 1, height: 30 }, { x: 841, y: 642, width: 1, height: 30 }, { x: 900, y: 186, width: 10, height: 30 }, { x: 690, y: 259, width: 20, height: 30 }, { x: 295, y: 415, width: 1, height: 30 }, { x: 240, y: 445, width: 1, height: 30 }, { x: 100, y: 472, width: 1, height: 29 }, { x: 382, y: 82, width: 1, height: 30 },// Árvores
            ]

        },
        'japan': {
            mapSrc: 'https://uploads.onecompiler.io/43rzumf93/44293xhug/mapajapan%20(1).png',
            mapWidth: 1600, mapHeight: 896,
            startPos: { x: 1500, y: 600 },
            collisions: [
                { x: 0, y: 0, width: 250, height: 900 }, { x: 248, y: 442, width: 30, height: 500 }, { x: 248, y: 280, width: 300, height: 120 }, { x: 249, y: 358, width: 30, height: 100 }, { x: 279, y: 399, width: 62, height: 50 }, { x: 421, y: 399, width: 35, height: 50 }, { x: 534, y: 450, width: 1, height: 1 }, { x: 279, y: 483, width: 34, height: 100 }, { x: 275, y: 598, width: 115, height: 310 }, { x: 390, y: 622, width: 10, height: 300 }, { x: 401, y: 650, width: 33, height: 220 }, { x: 434, y: 675, width: 63, height: 48 }, { x: 434, y: 723, width: 40, height: 30 }, { x: 434, y: 753, width: 10, height: 100 }, { x: 668, y: 468, width: 30, height: 30 }, // Esquerda (floresta, templo, sakuras)
                { x: 444, y: 797, width: 80, height: 200 }, { x: 588, y: 789, width: 1, height: 13 }, { x: 580, y: 462, width: 90, height: 90 }, { x: 627, y: 444, width: 80, height: 39 }, { x: 680, y: 780, width: 90, height: 60 }, { x: 813, y: 635, width: 12, height: 65 }, { x: 0, y: 0, width: 40, height: 40 },// Inferior meio (antes do rio)
                { x: 670, y: 0, width: 60, height: 270 }, { x: 509, y: 0, width: 161, height: 240 }, { x: 251, y: 0, width: 10, height: 180 }, { x: 251, y: 171, width: 15, height: 110 }, { x: 266, y: 203, width: 157, height: 75 }, { x: 262, y: 0, width: 200, height: 95 }, { x: 403, y: 95, width: 105, height: 55 }, { x: 692, y: 300, width: 50, height: 72 }, { x: 713, y: 382, width: 90, height: 34 }, { x: 741, y: 345, width: 40, height: 40 }, { x: 796, y: 280, width: 1, height: 27 }, { x: 730, y: 0, width: 400, height: 270 }, { x: 835, y: 338, width: 1, height: 10 }, { x: 810, y: 389, width: 45, height: 150 }, { x: 854, y: 424, width: 108, height: 120 }, { x: 949, y: 444, width: 45, height: 120 }, { x: 994, y: 457, width: 20, height: 100 }, { x: 841, y: 538, width: 110, height: 29 }, { x: 882, y: 565, width: 110, height: 10 }, { x: 872, y: 640, width: 320, height: 300 }, { x: 1191, y: 676, width: 42, height: 300 }, { x: 966, y: 481, width: 73, height: 119 }, { x: 713, y: 416, width: 90, height: 40 }, { x: 788, y: 453, width: 40, height: 20 }, { x: 559, y: 535, width: 21, height: 15 }, { x: 535, y: 549, width: 40, height: 11 }, { x: 508, y: 574, width: 1, height: 2 }, // Superior Meio e Rio ( árvores, chalé superior e rio)
                { x: 1229, y: 676, width: 200, height: 90 }, { x: 1302, y: 639, width: 160, height: 40 }, { x: 1425, y: 676, width: 54, height: 20 }, { x: 1425, y: 695, width: 27, height: 39 }, { x: 1449, y: 853, width: 160, height: 70 }, { x: 1509, y: 832, width: 90, height: 31 }, { x: 1312, y: 803, width: 50, height: 30 }, { x: 1268, y: 836, width: 20, height: 28 }, { x: 1233, y: 764, width: 23, height: 150 }, { x: 1345, y: 547, width: 68, height: 60 }, { x: 1558, y: 622, width: 40, height: 20 },// Inferior direito (estribeiras do mapa)
                { x: 1468, y: 428, width: 60, height: 50 }, { x: 1383, y: 0, width: 200, height: 365 }, { x: 1461, y: 0, width: 200, height: 400 }, { x: 1387, y: 420, width: 1, height: 12 }, { x: 1181, y: 347, width: 92, height: 127 }, { x: 1290, y: 479, width: 40, height: 26 }, { x: 1281, y: 378, width: 46, height: 55 }, { x: 1130, y: 0, width: 10, height: 249 }, { x: 1139, y: 0, width: 28, height: 230 }, { x: 1167, y: 0, width: 20, height: 194 }, { x: 1187, y: 0, width: 15, height: 180 }, { x: 1202, y: 0, width: 15, height: 170 }, { x: 1217, y: 0, width: 13, height: 160 }, { x: 1230, y: 0, width: 10, height: 150 }, { x: 1240, y: 0, width: 15, height: 110 }, { x: 1255, y: 0, width: 30, height: 80 }, { x: 1285, y: 0, width: 98, height: 40 }, { x: 1359, y: 0, width: 24, height: 350 }, { x: 1330, y: 110, width: 29, height: 221 }, { x: 1295, y: 152, width: 35, height: 152 }, { x: 1261, y: 200, width: 33, height: 90 }, { x: 1231, y: 245, width: 30, height: 40 }, { x: 1120, y: 430, width: 62, height: 170 }, { x: 1039, y: 380, width: 81, height: 220 }, { x: 0, y: 0, width: 40, height: 40 }, { x: 876, y: 315, width: 4, height: 4 }, { x: 959, y: 300, width: 43, height: 24 }// Superior direito (estribeiras do mapa/morros e contruções superiores)

            ]
        }
    };

    function forceLoadLevel(levelId) {
        try {
            console.log('[FORCE LOAD] solicitando load do level:', levelId);

            // 1) libera flags que podem bloquear o loop (dialogos/transicoes)
            if (typeof isDialogOpen !== 'undefined') {
                isDialogOpen = false;
                console.log('[FORCE LOAD] isDialogOpen forcado para false');
            }
            if (typeof isLoadingLevel !== 'undefined') {
                isLoadingLevel = true; // sinaliza que estamos carregando para evitar reentrância
            }

            // 2) tenta usar a loadLevel original, se existir
            if (typeof loadLevel === 'function') {
                console.log('[FORCE LOAD] chamando loadLevel() original...');
                loadLevel(levelId);
            } else {
                // 3) fallback mínimo — troca a variável do nível e tenta inicializar o nível manualmente
                console.warn('[FORCE LOAD] loadLevel() não encontrada — usando fallback manual');
                currentLevelId = levelId;
                // Se existir uma função initLevel, chamar; senão tentar redesenhar o mapa
                if (typeof initLevel === 'function') {
                    initLevel(levelId);
                } else if (typeof drawCurrentLevel === 'function') {
                    drawCurrentLevel();
                } else {
                    // tentativa genérica: recarrega o asset do mapa e pede redraw
                    const lvl = levels[levelId];
                    if (lvl && lvl.mapSrc && typeof loadImage === 'function') {
                        // se tens função loadImage -> carrega e chama redraw
                        loadImage(lvl.mapSrc, (img) => {
                            // espera que haja rotina que use currentLevelId / mapa carregado
                            currentLevelId = levelId;
                            if (typeof onLevelImageReady === 'function') onLevelImageReady(img, levelId);
                        });
                    } else {
                        // último recurso: seta currentLevelId e força o loop de render
                        currentLevelId = levelId;
                    }
                }
            }

            console.log('[FORCE LOAD] load solicitado: ', levelId);
        } catch (err) {
            console.error('[FORCE LOAD] erro ao forçar loadLevel:', err);
        } finally {
            // libera flag de loading (com pequeno delay para permitir init do level)
            setTimeout(() => {
                if (typeof isLoadingLevel !== 'undefined') isLoadingLevel = false;
                console.log('[FORCE LOAD] isLoadingLevel = false (finalizado)');
            }, 150); // delay pequeno para evitar reentrância imediata
        }
    }


    // --- Estado Global do Jogo ---
    let currentLevelId = 'library';
    let isGameLoopRunning = false;
    let isLoadingLevel = false;
    let isDialogOpen = false;

    // --- CARREGAMENTO DE ASSETS ---
    const assets = {
        maps: {},
        player: {
            runRight: new Image(), runLeft: new Image(), runUp: new Image(), runDown: new Image(),
            idleDown: new Image(), idleUp: new Image(), idleLeft: new Image(), idleRight: new Image()
        }
    };
    const playerAssetUrls = {
        runRight: 'https://uploads.onecompiler.io/43rztqetx/43zh9k8ba/run_right.png',
        runLeft: 'https://uploads.onecompiler.io/43rztqetx/43zh9k8ba/run_left.png',
        runUp: 'https://uploads.onecompiler.io/43rztqetx/43zh9k8ba/run_up.png',
        runDown: 'https://uploads.onecompiler.io/43rztqetx/43zh9k8ba/run_down.png',
        idleDown: 'https://uploads.onecompiler.io/43rzumf93/44293xhug/idle_down.png',
        idleUp: 'https://uploads.onecompiler.io/43rzumf93/44293xhug/idle_up.png',
        idleLeft: 'https://uploads.onecompiler.io/43rzumf93/44293xhug/idle_left.png',
        idleRight: 'https://uploads.onecompiler.io/43rzumf93/44293xhug/idle_right.png'
    };

    // ---  OBJETOS E ESTADO DO JOGO ---
    const camera = { x: 0, y: 0, width: canvas.width, height: canvas.height };
    const player = {
        x: 0, y: 0, width: 0, height: 0, drawWidth: 0, drawHeight: 0,
        hitbox: { offsetX: 0, offsetY: 0, width: 0, height: 0 },
        speed: 3.5, state: 'idleDown', direction: 'down',
        currentFrame: 0, animationSpeed: 15, frameCount: 0,
        animations: {
            runRight: { totalFrames: 8 }, runLeft: { totalFrames: 8 }, runUp: { totalFrames: 8 },
            runDown: { totalFrames: 8 }, idleDown: { totalFrames: 8 }, idleUp: { totalFrames: 8 },
            idleLeft: { totalFrames: 8 }, idleRight: { totalFrames: 8 }
        },
        targetX: null, targetY: null
    };
    const keys = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };
    const mouse = { worldX: 0, worldY: 0 };
    const joystick = { active: false, touchId: null, baseX: 0, baseY: 0, radius: 0, deadzone: 0 };

    // --- FUNÇÕES DE CONTROLO E INPUT ---
    function updateJoystickPosition() {
        const rect = joystickContainer.getBoundingClientRect();
        joystick.baseX = rect.left + rect.width / 2;
        joystick.baseY = rect.top + rect.height / 2;
        joystick.radius = rect.width / 2;
        joystick.deadzone = joystick.radius * 0.2;
    }

    function initJoystick() {
        const isMobile = 'ontouchstart' in window;
        if (!isMobile) {
            joystickContainer.style.display = 'none';
            actionButton.style.display = 'none';
            return;
        }
        joystickContainer.style.display = 'block';
        actionButton.style.display = 'flex';
        updateJoystickPosition();
        joystickContainer.addEventListener('touchstart', onTouchStart, { passive: false });
        document.addEventListener('touchmove', onTouchMove, { passive: false });
        document.addEventListener('touchend', onTouchEnd, { passive: false });
        actionButton.addEventListener('touchstart', (e) => {
            e.preventDefault();
            actionButton.classList.add('pressed');
            handleInteraction();
        }, { passive: false });
        actionButton.addEventListener('touchend', (e) => {
            e.preventDefault();
            actionButton.classList.remove('pressed');
        }, { passive: false });
    }

    function onTouchStart(event) {
        event.preventDefault();
        if (joystick.active) return;
        const touch = event.changedTouches[0];
        joystick.active = true;
        joystick.touchId = touch.identifier;
        onTouchMove(event);
    }

    function onTouchMove(event) {
        if (!joystick.active) return;
        let touch;
        for (let i = 0; i < event.changedTouches.length; i++) {
            if (event.changedTouches[i].identifier === joystick.touchId) {
                touch = event.changedTouches[i];
                break;
            }
        }
        if (!touch) return;
        event.preventDefault();
        let dx = touch.clientX - joystick.baseX;
        let dy = touch.clientY - joystick.baseY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > joystick.radius) {
            dx = (dx / distance) * joystick.radius;
            dy = (dy / distance) * joystick.radius;
        }
        joystickStick.style.transform = `translate(${dx}px, ${dy}px)`;
        keys.ArrowUp = keys.ArrowDown = keys.ArrowLeft = keys.ArrowRight = false;
        if (distance < joystick.deadzone) return;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);
        if (absDx > absDy) {
            if (dx > 0) keys.ArrowRight = true; else keys.ArrowLeft = true;
        } else {
            if (dy > 0) keys.ArrowDown = true; else keys.ArrowUp = true;
        }
    }

    function onTouchEnd(event) {
        if (!joystick.active) return;
        let isOurTouch = false;
        for (let i = 0; i < event.changedTouches.length; i++) {
            if (event.changedTouches[i].identifier === joystick.touchId) {
                isOurTouch = true;
                break;
            }
        }
        if (!isOurTouch) return;
        joystick.active = false;
        joystick.touchId = null;
        joystickStick.style.transform = 'translate(0px, 0px)';
        keys.ArrowUp = keys.ArrowDown = keys.ArrowLeft = keys.ArrowRight = false;
    }

    function initClickToMove() {
        canvas.addEventListener('click', handleWorldPointer);
        canvas.addEventListener('touchstart', handleWorldPointer, { passive: false });
    }

    function handleWorldPointer(event) {
        let targetId = event.target ? event.target.id : '';
        if (targetId === 'joystick-container' || targetId === 'joystick-stick' || targetId === 'action-button') return;
        event.preventDefault();
        let clientX, clientY;
        if (event.type === 'touchstart') {
            if (event.touches.length > 1) return;
            clientX = event.changedTouches[0].clientX;
            clientY = event.changedTouches[0].clientY;
        } else {
            clientX = event.clientX;
            clientY = event.clientY;
        }
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const screenX = (clientX - rect.left) * scaleX;
        const screenY = (clientY - rect.top) * scaleY;
        const worldX = screenX + camera.x;
        const worldY = screenY + camera.y;
        findNearestHotspot(worldX, worldY);
    }

    function findNearestHotspot(worldX, worldY) {
        const levelData = levels[currentLevelId];
        if (!levelData.hotspots || isLoadingLevel) return;
        let nearestHotspot = null;
        let minDistance = Infinity;
        const clickRadius = 150;
        for (const hotspot of levelData.hotspots) {
            const dx = hotspot.x - worldX;
            const dy = hotspot.y - worldY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < minDistance && distance < clickRadius) {
                minDistance = distance;
                nearestHotspot = hotspot;
            }
        }
        if (nearestHotspot) {
            player.targetX = nearestHotspot.x;
            player.targetY = nearestHotspot.y;
            keys.ArrowUp = keys.ArrowDown = keys.ArrowLeft = keys.ArrowRight = false;
        }
    }

    function initDebugTools() {
        if (!DEBUG_MODE) return;
        canvas.addEventListener('mousemove', (event) => {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            mouse.worldX = Math.floor((event.clientX - rect.left) * scaleX + camera.x);
            mouse.worldY = Math.floor((event.clientY - rect.top) * scaleY + camera.y);
        });
    }

    // --- "Ouvintes" de Teclado ---
    window.addEventListener('keydown', (event) => {
        if (event.repeat) return;
        const canvasStyle = window.getComputedStyle(canvas);

        // Se o menu inicial estiver visível, só o Enter inicia o jogo
        if (canvasStyle.display === 'none') {
            if (event.key === 'Enter') {
                event.preventDefault();
                startGame();
            }
            return;
        }

        // --- Movimento ---
        if (event.key in keys) {
            event.preventDefault();
            keys[event.key] = true;
        }

        // --- Interação (E ou Enter) ---
        if (event.key === 'e' || event.key === 'E' || event.key === 'Enter') {
            event.preventDefault();
            console.log('[INPUT] Interação detectada com', event.key);

            // Se um diálogo estiver aberto, fecha ele
            if (isDialogOpen) {
                console.log('[INPUT] Fechando diálogo (Enter/E)');
                const evt = new Event('dialog-closed');
                document.dispatchEvent(evt);
                return;
            }

            // Caso contrário, executa interação normal
            handleInteraction();
        }
    });

    window.addEventListener('keyup', (event) => {
        if (event.key in keys) {
            event.preventDefault();
            keys[event.key] = false;
        }
    });

    window.addEventListener('keyup', (event) => {
        if (event.key in keys) {
            event.preventDefault();
            keys[event.key] = false;
        }
    });

    window.addEventListener('blur', () => {
        keys.ArrowUp = keys.ArrowDown = keys.ArrowLeft = keys.ArrowRight = false;
    });

    // --- FUNÇÕES PRINCIPAIS DO JOGO ---
    function checkCollision(rect1, rect2) {
        return (
            rect1.x < rect2.x + rect2.width &&
            rect1.x + rect1.width > rect2.x &&
            rect1.y < rect2.y + rect2.height &&
            rect1.y + rect1.height > rect2.y
        );
    }

    // --- NOVO: Calcula a caixa de interação à frente do jogador ---
    function calculatePlayerInteractionBox() {

        const interactionDist = 5; // Distância base à frente da hitbox
        const overlapAmount = 30;   // Sobreposição na hitbox
        let interactionWidth = 30; // Largura padrão
        let interactionHeight = 30;// Altura padrão

        const hitboxX = player.x + player.hitbox.offsetX;
        const hitboxY = player.y + player.hitbox.offsetY;
        const hitboxW = player.hitbox.width;
        const hitboxH = player.hitbox.height;

        let ix = 0;
        let iy = 0;

        switch (player.direction) {
            case 'up':
                // --- MODIFICADO ---
                interactionWidth = 30;  // Caixa mais estreita
                interactionHeight = 70; // Caixa mais alta
                // Posiciona acima, sobrepõe, e centraliza horizontalmente
                iy = hitboxY - interactionDist - interactionHeight;
                ix = hitboxX + (hitboxW / 2) - (interactionWidth / 2);
                // ---------------
                break;
            case 'down':
                // --- MODIFICADO ---
                interactionWidth = 30;  // Caixa mais estreita
                interactionHeight = 50; // Caixa mais alta
                // Posiciona abaixo, sobrepõe, e centraliza horizontalmente
                iy = hitboxY + hitboxH + interactionDist - overlapAmount;
                ix = hitboxX + (hitboxW / 2) - (interactionWidth / 2);
                // ---------------
                break;
            case 'left':
                interactionWidth = 50;  // Caixa mais larga
                interactionHeight = 50; // Caixa mais alta
                ix = hitboxX - interactionDist - interactionWidth + overlapAmount;
                // Centraliza verticalmente, puxando um pouco para cima
                iy = hitboxY + (hitboxH / 2) - (interactionHeight / 2) - 10;
                break;
            case 'right':
                interactionWidth = 50;  // Caixa mais larga
                interactionHeight = 50; // Caixa mais alta
                ix = hitboxX + hitboxW + interactionDist - overlapAmount;
                // Centraliza verticalmente, puxando um pouco para cima
                iy = hitboxY + (hitboxH / 2) - (interactionHeight / 2) - 10;
                break;
        }

        return {
            x: Math.floor(ix),
            y: Math.floor(iy),
            width: interactionWidth,
            height: interactionHeight
        };
    }

    function handleInteraction(e) {
        console.log('[HANDLE] Interação detectada. isDialogOpen:', isDialogOpen);


        if (isLoadingLevel) return;
        const levelData = levels[currentLevelId];
        if (!levelData.interactables) return;

        const box = calculatePlayerInteractionBox();

        for (const item of levelData.interactables) {
            const rect = { x: item.x, y: item.y, width: item.width, height: item.height };

            if (checkCollision(box, rect)) {
                if (!isDialogOpen && typeof item.action === 'function') {
                    console.log(`[HANDLE] Executando ação de ${item.id}`);
                    item.action();
                } else if (isDialogOpen) {
                    console.log('[HANDLE] Ignorado — diálogo ainda ativo');
                }
                return;
            }
        }
    }

    function resizeCanvas() {
        console.log("--- resizeCanvas INICIADO ---"); // LOG Início

        const aspectRatio = GAME_WIDTH / GAME_HEIGHT;
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        console.log(`Window Dimensions: ${windowWidth}w x ${windowHeight}h`); // LOG Janela

        const windowRatio = windowWidth / windowHeight;

        let newWidth;
        let newHeight;

        if (windowRatio > aspectRatio) {
            newHeight = windowHeight;
            newWidth = newHeight * aspectRatio;
            console.log(`Modo Landscape/Wide: Limitado pela Altura.`); // LOG Modo
        } else {
            newWidth = windowWidth;
            newHeight = newWidth / aspectRatio;
            console.log(`Modo Portrait/Tall: Limitado pela Largura.`); // LOG Modo
        }

        // Arredonda para evitar pixels quebrados
        newWidth = Math.floor(newWidth);
        newHeight = Math.floor(newHeight);

        console.log(`Calculated Canvas Style: ${newWidth}px w x ${newHeight}px h`); // LOG Calculado

        // Aplica o novo tamanho ao estilo do canvas
        canvas.style.width = `${newWidth}px`;
        canvas.style.height = `${newHeight}px`;

        console.log(`Applied Style - Width: ${canvas.style.width}, Height: ${canvas.style.height}`); // LOG Aplicado

        // Pega as dimensões *reais* do elemento após aplicar o estilo
        // (setTimeout pequeno para dar tempo ao navegador de renderizar)
        setTimeout(() => {
            const rect = canvas.getBoundingClientRect();
            console.log(`Actual Element Rect (after style): ${rect.width.toFixed(2)}w x ${rect.height.toFixed(2)}h`); // LOG Real
        }, 10); // Aumentei ligeiramente o tempo para garantir a leitura

        if ('ontouchstart' in window) {
            updateJoystickPosition();
        }
        console.log(`--- resizeCanvas FINALIZADO --- Canvas Attrs: ${canvas.width}x${canvas.height}`); // LOG Fim
    }

    function update() {
        if (isDialogOpen || isLoadingLevel) return;
        const levelData = levels[currentLevelId];
        const oldX = player.x;
        const oldY = player.y;
        let dx = 0, dy = 0;
        let wantsToMove = false;

        if (keys.ArrowUp) { dy -= player.speed; }
        if (keys.ArrowDown) { dy += player.speed; }
        if (keys.ArrowLeft) { dx -= player.speed; }
        if (keys.ArrowRight) { dx += player.speed; }

        if (dx === 0 && dy === 0 && player.targetX !== null && player.targetY !== null) {
            const targetX_centered = player.targetX - (player.drawWidth / 2);
            const targetY_centered = player.targetY - (player.drawHeight / 2);
            const vecX = targetX_centered - player.x;
            const vecY = targetY_centered - player.y;
            const distance = Math.sqrt(vecX * vecX + vecY * vecY);
            if (distance < player.speed) {
                player.x = targetX_centered;
                player.y = targetY_centered;
                player.targetX = player.targetY = null;
                wantsToMove = false;
            } else {
                dx = (vecX / distance) * player.speed;
                dy = (vecY / distance) * player.speed;
                wantsToMove = true;
            }
        } else if (dx !== 0 || dy !== 0) {
            wantsToMove = true;
            player.targetX = player.targetY = null;
        }

        // --- SOM DE PASSOS: start/stop controlado ---
        if (wantsToMove && !isDialogOpen) {
            if (!player.stepSound) {
                player.stepSound = tocarSom(SONS.passos, 0.5, true);
            }
        } else {
            if (player.stepSound && player.stepSound.audio) {
                player.stepSound.audio.pause();
                player.stepSound.audio.currentTime = 0;
                player.stepSound = null;
            }
        }

        if (wantsToMove) {
            if (Math.abs(dx) > Math.abs(dy)) {
                if (dx > 0) { player.state = 'runRight'; player.direction = 'right'; }
                else { player.state = 'runLeft'; player.direction = 'left'; }
            } else { // movimento vertical dominante
                if (dy > 0) { player.state = 'runDown'; player.direction = 'down'; }
                else { player.state = 'runUp'; player.direction = 'up'; }
            }
        } else {
            // idle de acordo com a última direção
            if (player.direction === 'up') player.state = 'idleUp';
            else if (player.direction === 'left') player.state = 'idleLeft';
            else if (player.direction === 'right') player.state = 'idleRight';
            else player.state = 'idleDown';
        }

        // --- Aplica movimento com checagem de colisões ---
        if (dx !== 0) {
            player.x += dx;
            const playerHitbox = { x: player.x + player.hitbox.offsetX, y: oldY + player.hitbox.offsetY, width: player.hitbox.width, height: player.hitbox.height };
            if (levelData.collisions) {
                for (const collisionBox of levelData.collisions) {
                    if (checkCollision(playerHitbox, collisionBox)) {
                        player.x = oldX;
                        break;
                    }
                }
            }
        }
        if (dy !== 0) {
            player.y += dy;
            const playerHitbox = { x: player.x + player.hitbox.offsetX, y: player.y + player.hitbox.offsetY, width: player.hitbox.width, height: player.hitbox.height };
            if (levelData.collisions) {
                for (const collisionBox of levelData.collisions) {
                    if (checkCollision(playerHitbox, collisionBox)) {
                        player.y = oldY;
                        break;
                    }
                }
            }
        }

        // --- Animação frames ---
        player.frameCount++;
        if (player.frameCount >= player.animationSpeed) {
            player.frameCount = 0;
            player.currentFrame = (player.currentFrame + 1) % player.animations[player.state].totalFrames;
        }

        // --- Limites do mapa ---
        player.x = Math.max(0, Math.min(player.x, levelData.mapWidth - player.drawWidth));
        player.y = Math.max(0, Math.min(player.y, levelData.mapHeight - player.drawHeight));

        // --- Atualiza câmera mantendo o jogador dentro da camera box ---
        const boxLeft = camera.x + (camera.width - CAMERA_BOX_WIDTH) / 2;
        const boxRight = boxLeft + CAMERA_BOX_WIDTH;
        const boxTop = camera.y + (camera.height - CAMERA_BOX_HEIGHT) / 2;
        const boxBottom = boxTop + CAMERA_BOX_HEIGHT;
        if (player.x < boxLeft) camera.x = player.x - (camera.width - CAMERA_BOX_WIDTH) / 2;
        else if (player.x + player.drawWidth > boxRight) camera.x = player.x + player.drawWidth - CAMERA_BOX_WIDTH - (camera.width - CAMERA_BOX_WIDTH) / 2;
        if (player.y < boxTop) camera.y = player.y - (camera.height - CAMERA_BOX_HEIGHT) / 2;
        else if (player.y + player.drawHeight > boxBottom) camera.y = player.y + player.drawHeight - CAMERA_BOX_HEIGHT - (camera.height - CAMERA_BOX_HEIGHT) / 2;
        camera.x = Math.max(0, Math.min(camera.x, levelData.mapWidth - camera.width));
        camera.y = Math.max(0, Math.min(camera.y, levelData.mapHeight - camera.height));
    }

    function draw() {
        if (canvas.width !== GAME_WIDTH || canvas.height !== GAME_HEIGHT) {
            console.error(`ERRO: Resolução interna do Canvas alterada! É ${canvas.width}x${canvas.height}, deveria ser ${GAME_WIDTH}x${GAME_HEIGHT}`);
            // Opcional: Tentar corrigir (pode causar 'flicker')
            // canvas.width = GAME_WIDTH;
            // canvas.height = GAME_HEIGHT;
        }

        if (isLoadingLevel) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.translate(-camera.x, -camera.y);
        const levelData = levels[currentLevelId];
        const currentMapImage = assets.maps[currentLevelId];

        if (currentMapImage && currentMapImage.complete) {
            ctx.drawImage(currentMapImage, 0, 0, levelData.mapWidth, levelData.mapHeight);
        }

        if (levelData.hotspots) {
            ctx.save();
            for (const hotspot of levelData.hotspots) {
                const pulse = Math.abs(Math.sin(Date.now() / 300));
                const radius = 15 + pulse * 5;
                ctx.beginPath();
                ctx.arc(hotspot.x, hotspot.y, radius, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255, 220, 0, 0.4)';
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
                ctx.lineWidth = 2;
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = 'white';
                ctx.font = 'bold 18px Arial';
                ctx.textAlign = 'center';
                ctx.shadowColor = 'black';
                ctx.shadowBlur = 4;
                ctx.fillText(hotspot.name, hotspot.x, hotspot.y - (radius + 10));
            }
            ctx.restore();
        }

        let currentSpriteSheet;
        switch (player.state) {
            case 'runUp': currentSpriteSheet = assets.player.runUp; break;
            case 'runLeft': currentSpriteSheet = assets.player.runLeft; break;
            case 'runRight': currentSpriteSheet = assets.player.runRight; break;
            case 'runDown': currentSpriteSheet = assets.player.runDown; break;
            case 'idleUp': currentSpriteSheet = assets.player.idleUp; break;
            case 'idleLeft': currentSpriteSheet = assets.player.idleLeft; break;
            case 'idleRight': currentSpriteSheet = assets.player.idleRight; break;
            case 'idleDown': default: currentSpriteSheet = assets.player.idleDown; break;
        }
        if (currentSpriteSheet && currentSpriteSheet.complete && player.width > 0) {
            const sx = player.currentFrame * player.width;
            const sy = 0;
            ctx.drawImage(currentSpriteSheet, sx, sy, player.width, player.height, player.x, player.y, player.drawWidth, player.drawHeight);
        }

        if (DEBUG_MODE) {
            if (levelData.collisions) {
                ctx.fillStyle = 'rgba(255, 0, 0, 0.4)';
                for (const collisionBox of levelData.collisions) {
                    ctx.fillRect(collisionBox.x, collisionBox.y, collisionBox.width, collisionBox.height);
                }
            }
            ctx.strokeStyle = 'cyan';
            ctx.lineWidth = 2;
            ctx.strokeRect(player.x + player.hitbox.offsetX, player.y + player.hitbox.offsetY, player.hitbox.width, player.hitbox.height);


            // --- NOVO: Desenha as caixas interativas do nível ---
            if (levelData.interactables) {
                ctx.fillStyle = 'rgba(0, 255, 0, 0.4)'; // Verde semi-transparente
                for (const item of levelData.interactables) {
                    ctx.fillRect(item.x, item.y, item.width, item.height);
                }
            }

            // --- NOVO: Desenha a caixa de interação do jogador ---
            const playerInteractionBox = calculatePlayerInteractionBox();
            ctx.strokeStyle = 'yellow';
            ctx.lineWidth = 1;
            ctx.strokeRect(playerInteractionBox.x, playerInteractionBox.y, playerInteractionBox.width, playerInteractionBox.height);

        }

        ctx.restore();

        if (DEBUG_MODE) {
            // --- Cálculo de Escala e Tamanho da Fonte ---
            const currentCanvasStyleHeight = parseFloat(canvas.style.height) || canvas.height;
            const currentScale = currentCanvasStyleHeight / GAME_HEIGHT;
            const baseFontSize = 18; // Tamanho base
            const minFontSize = 12; // <-- NOVO: Tamanho mínimo definido aqui

            // Calcula o tamanho da fonte escalada (usando o minFontSize)
            const scaledFontSize = Math.max(minFontSize, Math.floor(baseFontSize * currentScale));

            // Define a fonte com o tamanho escalado
            ctx.font = `bold ${scaledFontSize}px Arial`;
            // --------------------------------------------------

            ctx.fillStyle = 'lime';
            ctx.textAlign = 'left';
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            const coordsText = `X: ${mouse.worldX}, Y: ${mouse.worldY}`;

            // --- Ajusta o fundo e a posição do texto ---
            const textWidth = ctx.measureText(coordsText).width;
            // Usa Math.max também para o padding, para não ficar menor que a fonte mínima
            const padding = Math.max(3, 5 * currentScale);
            const rectHeight = scaledFontSize + padding * 2;
            const rectWidth = textWidth + padding * 2;
            const rectX = 10;
            const rectY = 10;

            // Desenha o fundo
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.fillRect(rectX, rectY, rectWidth, rectHeight);

            // Desenha o texto (ajustado verticalmente dentro do fundo)
            ctx.fillStyle = 'lime';
            // Ajusta a posição Y do texto para alinhar melhor com a linha de base dentro do retângulo
            ctx.textBaseline = 'middle'; // Alinha verticalmente pelo meio
            ctx.fillText(coordsText, rectX + padding, rectY + rectHeight / 2); // Centraliza Y no retângulo
        }
    }

    function gameLoop() {
        if (!isGameLoopRunning) return;
        update();
        draw();
        requestAnimationFrame(gameLoop);
    }

    function loadLevel(levelId) {
        if (isLoadingLevel) return;
        isLoadingLevel = true;
        startScreen.style.display = 'flex';
        startScreen.innerText = 'Carregando...';
        const levelData = levels[levelId];
        const onMapReady = () => {
            currentLevelId = levelId;
            if (currentLevelId === 'library') {
                player.drawWidth = player.width * LIBRARY_PLAYER_SCALE;
                player.drawHeight = player.height * LIBRARY_PLAYER_SCALE;
            } else {
                player.drawWidth = player.width;
                player.drawHeight = player.height;
            }
            player.hitbox.width = player.drawWidth * 0.5;
            player.hitbox.height = player.drawHeight * 0.3;
            player.hitbox.offsetX = (player.drawWidth - player.hitbox.width) / 2;
            player.hitbox.offsetY = player.drawHeight * 0.7;
            player.x = levelData.startPos.x - (player.drawWidth / 2);
            player.y = levelData.startPos.y - (player.drawHeight / 2);
            player.targetX = player.targetY = null;
            camera.x = player.x - (camera.width / 2) + (player.drawWidth / 2);
            camera.y = player.y - (camera.height / 2) + (player.drawHeight / 2);
            camera.x = Math.max(0, Math.min(camera.x, levelData.mapWidth - camera.width));
            camera.y = Math.max(0, Math.min(camera.y, levelData.mapHeight - camera.height));
            startScreen.style.display = 'none';
            isLoadingLevel = false;
            if (!isGameLoopRunning) {
                isGameLoopRunning = true;
                gameLoop();
            }
        };
        if (assets.maps[levelId] && assets.maps[levelId].complete) {
            onMapReady();
        } else {
            assets.maps[levelId] = new Image();
            assets.maps[levelId].onload = onMapReady;
            assets.maps[levelId].onerror = () => console.error(`Erro ao carregar o mapa: ${levelData.mapSrc}`);
            assets.maps[levelId].src = levelData.mapSrc;
        }
    }

    function startGame() {
        startScreen.style.display = 'none';
        canvas.style.display = 'block';
        resizeCanvas();
        startScreen.style.display = 'flex';
        startScreen.innerText = 'Carregando Jogo...';
        let playerAssetsLoaded = 0;
        const totalPlayerAssets = Object.keys(playerAssetUrls).length;

        const onPlayerAssetLoad = () => {
            playerAssetsLoaded++;
            if (playerAssetsLoaded === totalPlayerAssets) {
                runFinalSetupAndLoadFirstLevel();
            }
        };

        const runFinalSetupAndLoadFirstLevel = () => {
            const frameData = assets.player.idleDown;
            if (frameData.complete && frameData.naturalWidth > 0) {
                player.width = frameData.naturalWidth / player.animations.idleDown.totalFrames;
                player.height = frameData.naturalHeight;
            } else {
                player.width = 64; player.height = 64;
            }
            player.drawWidth = player.width;
            player.drawHeight = player.height;
            transicaoParaLibrary(() => loadLevel('library'));
        };

        let allReady = true;
        for (const key in assets.player) {
            const img = assets.player[key];
            if (!img.complete || img.naturalWidth === 0) {
                allReady = false;
                break;
            }
        }

        if (allReady) {
            runFinalSetupAndLoadFirstLevel();
        } else {
            const onError = (assetName, e) => console.error(`ERRO AO CARREGAR ASSET: ${assetName}`, e);
            for (const key in playerAssetUrls) {
                assets.player[key].onload = onPlayerAssetLoad;
                assets.player[key].onerror = (e) => onError(key, e);
                assets.player[key].src = playerAssetUrls[key];
            }
        }
    }

    window.addEventListener('resize', resizeCanvas);

    // --- PONTO DE ENTRADA ---
    resizeCanvas();
    initJoystick();
    initClickToMove();
    initDebugTools();

    // Preenchimento das funções de input para garantir que existem
    // (O seu ficheiro já deve ter estas definições completas, isto é uma salvaguarda)
    if (typeof onTouchStart !== 'function') {
        window.onTouchStart = function (event) {
            event.preventDefault();
            if (joystick.active) return;
            const touch = event.changedTouches[0];
            joystick.active = true;
            joystick.touchId = touch.identifier;
            onTouchMove(event);
        };

        window.onTouchMove = function (event) {
            if (!joystick.active) return;
            let touch;
            for (let i = 0; i < event.changedTouches.length; i++) {
                if (event.changedTouches[i].identifier === joystick.touchId) {
                    touch = event.changedTouches[i];
                    break;
                }
            }
            if (!touch) return;
            event.preventDefault();
            let dx = touch.clientX - joystick.baseX;
            let dy = touch.clientY - joystick.baseY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance > joystick.radius) {
                dx = (dx / distance) * joystick.radius;
                dy = (dy / distance) * joystick.radius;
            }
            joystickStick.style.transform = `translate(${dx}px, ${dy}px)`;
            keys.ArrowUp = keys.ArrowDown = keys.ArrowLeft = keys.ArrowRight = false;
            if (distance < joystick.deadzone) return;
            const absDx = Math.abs(dx);
            const absDy = Math.abs(dy);
            if (absDx > absDy) {
                if (dx > 0) keys.ArrowRight = true;
                else keys.ArrowLeft = true;
            } else {
                if (dy > 0) keys.ArrowDown = true;
                else keys.ArrowUp = true;
            }
        };

        window.onTouchEnd = function (event) {
            if (!joystick.active) return;
            let isOurTouch = false;
            for (let i = 0; i < event.changedTouches.length; i++) {
                if (event.changedTouches[i].identifier === joystick.touchId) {
                    isOurTouch = true;
                    break;
                }
            }
            if (!isOurTouch) return;
            joystick.active = false;
            joystick.touchId = null;
            joystickStick.style.transform = 'translate(0px, 0px)';
            keys.ArrowUp = keys.ArrowDown = keys.ArrowLeft = keys.ArrowRight = false;
        };
    }

    // desbloqueia com interação do usuário
    document.addEventListener('click', initAudio, { once: true });
    document.addEventListener('keydown', initAudio, { once: true });
});
