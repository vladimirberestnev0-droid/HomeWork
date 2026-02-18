// ===== GROUP-CHAT.JS — Логика группового чата =====

(function() {
    // Параметры URL
    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get('orderId');
    const participantsParam = urlParams.get('participants');
    const participantIds = participantsParam ? participantsParam.split(',') : [];

    // Состояние
    let chatId = null;
    let orderData = null;
    let unsubscribe = null;
    let typingTimeouts = {};
    let selectedFiles = [];
    let participants = [];

    // Инициализация
    document.addEventListener('DOMContentLoaded', () => {
        Auth.onAuthStateChanged(async (user) => {
            if (!user) {
                window.location.href = 'index.html';
                return;
            }

            if (!orderId || participantIds.length === 0) {
                alert('Ошибка: не указан заказ или участники');
                window.location.href = 'index.html';
                return;
            }

            // Добавляем текущего пользователя
            if (!participantIds.includes(user.uid)) {
                participantIds.push(user.uid);
            }

            chatId = `group_${orderId}_${participantIds.sort().join('_')}`;

            await loadOrderData();
            await initializeChat();
            await loadParticipants();
            
            listenToMessages();
            setupTypingIndicator();
            listenToPinnedMessage();
            listenToTimer();
        });

        initEventListeners();
    });

    // Загрузка данных заказа
    async function loadOrderData() {
        try {
            const orderDoc = await db.collection('orders').doc(orderId).get();
            if (!orderDoc.exists) {
                alert('Заказ не найден');
                window.location.href = 'index.html';
                return;
            }

            orderData = { id: orderDoc.id, ...orderDoc.data() };
            
            document.getElementById('chatTitle').innerText = `Заказ: ${orderData.title || 'Без названия'}`;
            document.getElementById('chatSubtitle').innerHTML = `<i class="fas fa-users"></i> Групповой чат · ${orderData.price || 0} ₽`;
            
            const pinnedOrder = document.getElementById('pinnedOrder');
            if (pinnedOrder && orderData) {
                document.getElementById('pinnedTitle').innerText = orderData.title || 'Заказ';
                document.getElementById('pinnedPrice').innerText = orderData.price || '0';
                document.getElementById('pinnedAddress').innerText = orderData.address || 'Адрес не указан';
                pinnedOrder.classList.remove('hidden');
            }
            
        } catch (error) {
            console.error('❌ Ошибка загрузки заказа:', error);
            alert('Ошибка загрузки данных заказа');
        }
    }

    // Инициализация чата
    async function initializeChat() {
        try {
            const chatRef = db.collection('groupChats').doc(chatId);
            const chatDoc = await chatRef.get();
            
            if (!chatDoc.exists) {
                await chatRef.set({
                    orderId: orderId,
                    participants: participantIds,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    type: 'group'
                });
            }
        } catch (error) {
            console.error('❌ Ошибка инициализации чата:', error);
        }
    }

    // Загрузка участников
    async function loadParticipants() {
        participants = [];
        for (const userId of participantIds) {
            try {
                const userDoc = await db.collection('users').doc(userId).get();
                if (userDoc.exists) {
                    participants.push({
                        id: userId,
                        ...userDoc.data()
                    });
                }
            } catch (error) {
                console.error('❌ Ошибка загрузки участника:', error);
            }
        }
        
        document.getElementById('participantsCount').innerText = participants.length;
    }

    // Слушаем сообщения
    function listenToMessages() {
        if (!chatId) return;
        
        const messagesArea = document.getElementById('messagesArea');
        
        if (unsubscribe) unsubscribe();
        
        unsubscribe = db.collection('groupChats').doc(chatId)
            .collection('messages')
            .orderBy('timestamp', 'asc')
            .onSnapshot((snapshot) => {
                if (snapshot.empty) {
                    messagesArea.innerHTML = `
                        <div class="empty-chat">
                            <i class="fas fa-comments"></i>
                            <h3>Начните диалог</h3>
                            <p>Напишите первое сообщение</p>
                        </div>
                    `;
                    return;
                }

                messagesArea.innerHTML = '';
                snapshot.forEach(doc => {
                    const msg = doc.data();
                    if (msg.type === 'poll') {
                        messagesArea.appendChild(createPollElement(msg));
                    } else {
                        messagesArea.appendChild(createMessageElement(msg));
                    }
                });
                
                setTimeout(() => {
                    messagesArea.scrollTop = messagesArea.scrollHeight;
                }, 100);
            });
    }

    // Форматирование времени
    function formatMessageTime(timestamp) {
        if (!timestamp) return 'только что';
        
        const date = timestamp.toDate();
        const now = new Date();
        const diff = now - date;
        
        if (diff < 86400000) {
            return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        } else {
            return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) + 
                   ', ' + date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        }
    }

    // Имя пользователя по ID
    function getUserName(userId) {
        const user = participants.find(p => p.id === userId);
        return user ? (user.name || 'Пользователь') : 'Пользователь';
    }

    // Создание элемента сообщения
    function createMessageElement(message) {
        const user = Auth.getUser();
        const div = document.createElement('div');
        div.className = `message ${message.senderId === user?.uid ? 'sent' : 'received'}`;
        
        let filesHtml = '';
        if (message.files?.length > 0) {
            filesHtml = '<div class="message-files">';
            message.files.forEach(file => {
                if (file.type?.startsWith('image/')) {
                    filesHtml += `<img src="${file.url}" class="message-image" onclick="window.open('${file.url}')" title="${file.name}">`;
                } else {
                    const icon = file.type?.includes('pdf') ? 'fa-file-pdf' :
                               file.type?.includes('word') ? 'fa-file-word' :
                               file.type?.includes('excel') ? 'fa-file-excel' : 'fa-file';
                    filesHtml += `<a href="${file.url}" target="_blank" class="message-file"><i class="fas ${icon}"></i>${file.name}</a>`;
                }
            });
            filesHtml += '</div>';
        }
        
        const time = formatMessageTime(message.timestamp);
        const senderName = message.senderId !== user?.uid ? 
            `<div class="message-sender-name">${Utils.escapeHtml(getUserName(message.senderId))}</div>` : '';
        
        div.innerHTML = `
            <div class="message-bubble">
                ${senderName}
                ${Utils.escapeHtml(message.text) || ''}
                ${filesHtml}
            </div>
            <div class="message-time">${time}</div>
        `;
        
        // Добавляем кнопку закрепления при наведении
        if (message.senderId === user?.uid) {
            div.addEventListener('mouseenter', () => {
                const pinBtn = document.createElement('button');
                pinBtn.innerHTML = '<i class="fas fa-thumbtack"></i>';
                pinBtn.style.cssText = 'position: absolute; top: 0; right: -30px; background: none; border: none; color: var(--accent); cursor: pointer;';
                pinBtn.onclick = () => pinMessage(message);
                div.style.position = 'relative';
                div.appendChild(pinBtn);
            });
        }
        
        return div;
    }

    // Создание элемента опроса
    function createPollElement(poll) {
        const user = Auth.getUser();
        const div = document.createElement('div');
        div.className = 'card poll-card';
        
        const totalVotes = poll.votes ? Object.keys(poll.votes).length : 0;
        const userVote = poll.votes?.[user.uid];
        
        let optionsHtml = '';
        poll.options.forEach((option, index) => {
            const votesCount = poll.votes ? Object.values(poll.votes).filter(v => v === index).length : 0;
            const percentage = totalVotes > 0 ? (votesCount / totalVotes * 100).toFixed(0) : 0;
            
            optionsHtml += `
                <div class="poll-option ${userVote === index ? 'selected' : ''}" onclick="votePoll('${poll.id}', ${index})">
                    <span style="min-width: 30px;">${index + 1}.</span>
                    <span style="flex: 1;">${Utils.escapeHtml(option)}</span>
                    <div class="poll-progress">
                        <div class="poll-progress-fill" style="width: ${percentage}%;"></div>
                    </div>
                    <span style="min-width: 50px; text-align: right;">${percentage}%</span>
                </div>
            `;
        });
        
        const timeLeft = poll.expiresAt ? Math.max(0, poll.expiresAt.toDate() - new Date()) : 0;
        const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
        
        div.innerHTML = `
            <div class="poll-question">${Utils.escapeHtml(poll.question)}</div>
            ${optionsHtml}
            <div class="mt-3 text-secondary small">
                <i class="fas fa-users me-1"></i>Голосов: ${totalVotes}
                ${poll.expiresAt ? `<span class="ms-3"><i class="fas fa-clock me-1"></i>Осталось: ${hoursLeft} ч</span>` : ''}
            </div>
        `;
        
        return div;
    }

    // Индикатор печати
    function setupTypingIndicator() {
        if (!chatId) return;
        
        const user = Auth.getUser();
        if (!user) return;
        
        const input = document.getElementById('messageInput');
        const typingRef = db.collection('groupChats').doc(chatId).collection('typing').doc(user.uid);
        
        input.addEventListener('input', () => {
            typingRef.set({
                isTyping: true,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            if (typingTimeouts[user.uid]) {
                clearTimeout(typingTimeouts[user.uid]);
            }
            
            typingTimeouts[user.uid] = setTimeout(() => {
                typingRef.delete();
            }, 2000);
        });
        
        // Слушаем индикаторы всех участников
        db.collection('groupChats').doc(chatId).collection('typing')
            .onSnapshot((snapshot) => {
                const typingIndicator = document.getElementById('typingIndicator');
                const typingUsers = [];
                
                snapshot.forEach(doc => {
                    if (doc.id !== user.uid && doc.data().isTyping) {
                        const userName = getUserName(doc.id);
                        typingUsers.push(userName);
                    }
                });
                
                if (typingUsers.length > 0) {
                    if (typingUsers.length === 1) {
                        typingIndicator.innerText = `${typingUsers[0]} печатает...`;
                    } else {
                        typingIndicator.innerText = 'Несколько человек печатают...';
                    }
                    typingIndicator.classList.remove('hidden');
                } else {
                    typingIndicator.classList.add('hidden');
                }
            });
    }

    // Слушаем закрепленное сообщение
    function listenToPinnedMessage() {
        db.collection('groupChats').doc(chatId).onSnapshot((doc) => {
            const data = doc.data();
            if (data?.pinnedMessage) {
                document.getElementById('pinnedMessageText').innerText = data.pinnedMessage.text;
                document.getElementById('pinnedMessage').classList.remove('hidden');
            } else {
                document.getElementById('pinnedMessage').classList.add('hidden');
            }
        });
    }

    // Слушаем таймер
    function listenToTimer() {
        db.collection('groupChats').doc(chatId).onSnapshot((doc) => {
            const data = doc.data();
            if (data?.timer) {
                const timerDiv = document.getElementById('groupTimer');
                const endTime = data.timer.endTime.toDate();
                
                const updateTimer = () => {
                    const now = new Date();
                    const diff = endTime - now;
                    
                    if (diff <= 0) {
                        timerDiv.classList.add('hidden');
                        return;
                    }
                    
                    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                    
                    timerDiv.innerHTML = `
                        <i class="fas fa-hourglass-half me-2"></i>
                        ${data.timer.title}: ${days}д ${hours}ч ${minutes}м
                    `;
                    timerDiv.classList.remove('hidden');
                };
                
                updateTimer();
                setInterval(updateTimer, 60000);
            }
        });
    }

    // Отправка сообщения
    async function sendMessage() {
        const input = document.getElementById('messageInput');
        const text = input.value.trim();
        
        if ((!text || text === '') && selectedFiles.length === 0) return;
        
        try {
            const fileUrls = [];
            for (let file of selectedFiles) {
                const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}_${file.name}`;
                const storageRef = storage.ref(`group_chat_files/${chatId}/${fileName}`);
                
                await storageRef.put(file);
                const url = await storageRef.getDownloadURL();
                
                fileUrls.push({
                    url: url,
                    name: file.name,
                    type: file.type,
                    size: file.size
                });
            }
            
            await db.collection('groupChats').doc(chatId)
                .collection('messages')
                .add({
                    text: text,
                    files: fileUrls,
                    senderId: Auth.getUser().uid,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });
            
            await db.collection('groupChats').doc(chatId).update({
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastMessage: text || '[Файл]',
                lastSenderId: Auth.getUser().uid
            });
            
            input.value = '';
            selectedFiles = [];
            updateFilePreview();
            
            const typingRef = db.collection('groupChats').doc(chatId).collection('typing').doc(Auth.getUser().uid);
            await typingRef.delete();
            
        } catch (error) {
            console.error('❌ Ошибка отправки:', error);
            Utils.showNotification('Не удалось отправить сообщение', 'error');
        }
    }

    // Инициализация обработчиков
    function initEventListeners() {
        // Загрузка файлов
        const attachButton = document.getElementById('attachButton');
        const fileInput = document.getElementById('fileInput');

        attachButton?.addEventListener('click', () => fileInput.click());

        fileInput?.addEventListener('change', (e) => {
            handleFileSelect(e.target.files);
        });

        // Отправка по Enter
        document.getElementById('sendButton')?.addEventListener('click', sendMessage);
        document.getElementById('messageInput')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                sendMessage();
            }
        });

        // Управление участниками
        const participantsBtn = document.getElementById('participantsBtn');
        const participantsModal = document.getElementById('participantsModal');
        const closeModal = document.getElementById('closeModal');

        participantsBtn?.addEventListener('click', showParticipantsModal);
        closeModal?.addEventListener('click', () => participantsModal.classList.add('hidden'));

        participantsModal?.addEventListener('click', (e) => {
            if (e.target === participantsModal) {
                participantsModal.classList.add('hidden');
            }
        });

        document.getElementById('addParticipantBtn')?.addEventListener('click', addParticipant);

        // Опросы
        document.getElementById('pollButton')?.addEventListener('click', () => {
            document.getElementById('pollModal').classList.remove('hidden');
        });

        // Темная тема
        document.getElementById('themeToggle')?.addEventListener('click', Auth.toggleTheme);
    }

    // Обработка выбора файлов
    function handleFileSelect(files) {
        for (let file of files) {
            if (file.size > 10 * 1024 * 1024) {
                Utils.showNotification('Файл слишком большой (макс 10MB)', 'warning');
                continue;
            }
            selectedFiles.push(file);
        }
        updateFilePreview();
    }

    // Обновление превью файлов
    function updateFilePreview() {
        const filePreview = document.getElementById('filePreview');
        
        if (selectedFiles.length === 0) {
            filePreview.classList.add('hidden');
            filePreview.innerHTML = '';
            return;
        }
        
        filePreview.classList.remove('hidden');
        filePreview.innerHTML = '';
        
        selectedFiles.forEach((file, index) => {
            const previewItem = document.createElement('div');
            previewItem.className = 'file-preview-item';
            
            let icon = 'fa-file';
            if (file.type.startsWith('image/')) icon = 'fa-image';
            else if (file.type.startsWith('video/')) icon = 'fa-video';
            else if (file.type.includes('pdf')) icon = 'fa-file-pdf';
            
            previewItem.innerHTML = `
                <i class="fas ${icon}"></i>
                <span>${file.name.length > 20 ? file.name.substring(0, 17) + '...' : file.name}</span>
                <span class="remove-file" onclick="removeFile(${index})">×</span>
            `;
            filePreview.appendChild(previewItem);
        });
    }

    window.removeFile = function(index) {
        selectedFiles.splice(index, 1);
        updateFilePreview();
    };

    // Закрепить сообщение
    async function pinMessage(message) {
        await db.collection('groupChats').doc(chatId).update({
            pinnedMessage: {
                text: message.text || '[Файл]',
                senderId: message.senderId,
                timestamp: message.timestamp
            }
        });
    }

    // Открепить сообщение
    window.unpinMessage = async function() {
        await db.collection('groupChats').doc(chatId).update({
            pinnedMessage: firebase.firestore.FieldValue.delete()
        });
    };

    // Показать участников
    async function showParticipantsModal() {
        const list = document.getElementById('participantsList');
        list.innerHTML = '';
        
        for (const user of participants) {
            const div = document.createElement('div');
            div.className = 'participant-item';
            div.innerHTML = `
                <div class="participant-avatar">
                    <i class="fas fa-user"></i>
                </div>
                <div>
                    <div class="participant-name">${Utils.escapeHtml(user.name || 'Пользователь')}</div>
                    <div class="participant-role">${user.role === 'master' ? 'Мастер' : 'Клиент'}</div>
                </div>
            `;
            list.appendChild(div);
        }
        
        document.getElementById('participantsModal').classList.remove('hidden');
    }

    // Добавить участника
    async function addParticipant() {
        const newParticipantId = prompt('Введите ID пользователя:');
        if (newParticipantId && !participantIds.includes(newParticipantId)) {
            participantIds.push(newParticipantId);
            await db.collection('groupChats').doc(chatId).update({
                participants: participantIds
            });
            await loadParticipants();
            Utils.showNotification('✅ Участник добавлен', 'success');
        }
    }

    // Опросы
    window.addPollOption = function() {
        const container = document.getElementById('pollOptions');
        const optionDiv = document.createElement('div');
        optionDiv.className = 'poll-option-input mb-2';
        optionDiv.innerHTML = `
            <input type="text" class="form-control poll-option" placeholder="Вариант ${container.children.length + 1}">
            <button class="btn btn-danger btn-sm remove-option" onclick="this.parentElement.remove()">×</button>
        `;
        container.appendChild(optionDiv);
    };

    window.closePollModal = function() {
        document.getElementById('pollModal').classList.add('hidden');
    };

    window.createPoll = async function() {
        const question = document.getElementById('pollQuestion').value;
        const options = Array.from(document.querySelectorAll('.poll-option')).map(input => input.value).filter(v => v);
        const duration = parseInt(document.getElementById('pollDuration').value);
        
        if (!question || options.length < 2) {
            alert('Введите вопрос и минимум 2 варианта');
            return;
        }
        
        const poll = {
            type: 'poll',
            question: question,
            options: options,
            votes: {},
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            expiresAt: new Date(Date.now() + duration * 60 * 60 * 1000),
            senderId: Auth.getUser().uid
        };
        
        await db.collection('groupChats').doc(chatId)
            .collection('messages')
            .add(poll);
        
        closePollModal();
    };

    window.votePoll = async function(messageId, optionIndex) {
        const user = Auth.getUser();
        if (!user) return;
        
        const messageRef = db.collection('groupChats').doc(chatId)
            .collection('messages').doc(messageId);
        
        await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(messageRef);
            const votes = doc.data().votes || {};
            
            if (votes[user.uid] !== undefined) {
                Utils.showNotification('Вы уже голосовали', 'warning');
                return;
            }
            
            votes[user.uid] = optionIndex;
            transaction.update(messageRef, { votes });
        });
    };

    // Очистка при выходе
    window.addEventListener('beforeunload', () => {
        if (unsubscribe) unsubscribe();
    });
})();