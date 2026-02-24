// ===== js/services/video-chat.js =====
// Видео-чат на WebRTC

const VideoChat = (function() {
    let localStream = null;
    let peerConnection = null;
    let currentCall = null;
    let mediaRecorder = null;
    let listeners = new Map();

    const CONFIG = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
        ]
    };

    /**
     * Проверка поддержки WebRTC
     */
    function isSupported() {
        return !!(navigator.mediaDevices && window.RTCPeerConnection);
    }

    /**
     * Инициализация видео-чата
     */
    async function initVideoChat(chatId, isInitiator) {
        try {
            if (!isSupported()) {
                throw new Error('WebRTC не поддерживается в этом браузере');
            }

            if (!chatId) {
                throw new Error('Не указан ID чата');
            }

            // Запрашиваем доступ к камере/микрофону
            localStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });

            // Показываем локальное видео
            const localVideo = document.getElementById('localVideo');
            if (localVideo) {
                localVideo.srcObject = localStream;
            }

            // Создаем PeerConnection
            peerConnection = new RTCPeerConnection(CONFIG);

            // Добавляем треки
            localStream.getTracks().forEach(track => {
                peerConnection.addTrack(track, localStream);
            });

            // Обработка удаленного потока
            peerConnection.ontrack = (event) => {
                const remoteVideo = document.getElementById('remoteVideo');
                if (remoteVideo && event.streams[0]) {
                    remoteVideo.srcObject = event.streams[0];
                }
                
                // Уведомляем слушателей
                emit('remoteStream', event.streams[0]);
            };

            // Обработка состояния соединения
            peerConnection.onconnectionstatechange = () => {
                console.log('📞 Состояние соединения:', peerConnection.connectionState);
                emit('connectionState', peerConnection.connectionState);
                
                if (peerConnection.connectionState === 'disconnected' || 
                    peerConnection.connectionState === 'failed') {
                    endCall();
                }
            };

            // Обмен ICE кандидатами
            peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    sendIceCandidate(chatId, event.candidate);
                }
            };

            if (isInitiator) {
                // Создаем оффер
                const offer = await peerConnection.createOffer();
                await peerConnection.setLocalDescription(offer);
                
                // Отправляем оффер в Firebase
                await sendOffer(chatId, offer);
            }

            // Слушаем сигналы
            listenForSignals(chatId);

            currentCall = { chatId, isInitiator };
            
            return { success: true, stream: localStream };
            
        } catch (error) {
            console.error('Ошибка инициализации видео:', error);
            
            // Освобождаем ресурсы при ошибке
            if (localStream) {
                localStream.getTracks().forEach(track => track.stop());
                localStream = null;
            }
            
            Helpers.showNotification('❌ ' + error.message, 'error');
            return { success: false, error: error.message };
        }
    }

    /**
     * Отправка оффера
     */
    async function sendOffer(chatId, offer) {
        await db.collection('video_signals').doc(chatId).set({
            type: 'offer',
            data: offer,
            senderId: Auth.getUser().uid,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
    }

    /**
     * Отправка ответа
     */
    async function sendAnswer(chatId, answer) {
        await db.collection('video_signals').doc(chatId).update({
            type: 'answer',
            data: answer,
            senderId: Auth.getUser().uid,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
    }

    /**
     * Отправка ICE кандидата
     */
    async function sendIceCandidate(chatId, candidate) {
        await db.collection('video_signals').doc(chatId).collection('candidates').add({
            candidate: candidate,
            senderId: Auth.getUser().uid,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
    }

    /**
     * Слушаем сигналы
     */
    function listenForSignals(chatId) {
        // Слушаем офферы/ответы
        db.collection('video_signals').doc(chatId)
            .onSnapshot(async (doc) => {
                if (!doc.exists) return;

                const signal = doc.data();
                const user = Auth.getUser();
                if (!user) return;

                if (signal.senderId === user.uid) return;

                try {
                    if (signal.type === 'offer' && peerConnection && !peerConnection.currentRemoteDescription) {
                        // Получили оффер - отвечаем
                        await peerConnection.setRemoteDescription(new RTCSessionDescription(signal.data));
                        const answer = await peerConnection.createAnswer();
                        await peerConnection.setLocalDescription(answer);
                        await sendAnswer(chatId, answer);
                    }
                    
                    if (signal.type === 'answer' && peerConnection && peerConnection.signalingState !== 'stable') {
                        // Получили ответ
                        await peerConnection.setRemoteDescription(new RTCSessionDescription(signal.data));
                    }
                } catch (e) {
                    console.error('Ошибка обработки сигнала:', e);
                }
            });

        // Слушаем ICE кандидатов
        db.collection('video_signals').doc(chatId).collection('candidates')
            .onSnapshot((snapshot) => {
                snapshot.docChanges().forEach(async (change) => {
                    if (change.type === 'added') {
                        const candidate = change.doc.data();
                        const user = Auth.getUser();
                        
                        if (candidate.senderId !== user?.uid && peerConnection) {
                            try {
                                await peerConnection.addIceCandidate(new RTCIceCandidate(candidate.candidate));
                            } catch (e) {
                                console.warn('Ошибка добавления ICE кандидата:', e);
                            }
                        }
                    }
                });
            });
    }

    /**
     * Завершение звонка
     */
    function endCall() {
        if (peerConnection) {
            peerConnection.close();
            peerConnection = null;
        }

        if (localStream) {
            localStream.getTracks().forEach(track => {
                track.stop();
            });
            localStream = null;
        }

        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
            mediaRecorder = null;
        }

        currentCall = null;
        
        // Очищаем видео элементы
        const localVideo = document.getElementById('localVideo');
        const remoteVideo = document.getElementById('remoteVideo');
        
        if (localVideo) localVideo.srcObject = null;
        if (remoteVideo) remoteVideo.srcObject = null;
        
        emit('callEnded', null);
    }

    /**
     * Запись видео-консультации
     */
    async function startRecording() {
        try {
            if (!localStream) {
                throw new Error('Нет видеопотока');
            }

            mediaRecorder = new MediaRecorder(localStream);
            const chunks = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunks.push(e.data);
                }
            };
            
            mediaRecorder.onstop = async () => {
                const blob = new Blob(chunks, { type: 'video/webm' });
                
                // Сохраняем в Firebase Storage
                const fileName = `consultation_${Date.now()}.webm`;
                const storageRef = storage.ref(`consultations/${fileName}`);
                await storageRef.put(blob);
                
                const downloadUrl = await storageRef.getDownloadURL();
                
                // Сохраняем ссылку в заказе
                if (currentCall) {
                    await db.collection('orders').doc(currentCall.orderId).update({
                        consultationVideo: downloadUrl
                    });
                }
                
                emit('recordingComplete', downloadUrl);
            };

            mediaRecorder.start();
            return mediaRecorder;
            
        } catch (error) {
            console.error('Ошибка записи:', error);
            return null;
        }
    }

    /**
     * Остановка записи
     */
    function stopRecording() {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
        }
    }

    /**
     * Скриншот с камеры
     */
    function takeSnapshot() {
        if (!localStream) return null;

        const video = document.getElementById('localVideo');
        if (!video || !video.videoWidth) return null;

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        
        return canvas.toDataURL('image/jpeg');
    }

    /**
     * Переключение микрофона
     */
    function toggleMute() {
        if (!localStream) return false;
        
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            return audioTrack.enabled;
        }
        return false;
    }

    /**
     * Переключение камеры
     */
    function toggleVideo() {
        if (!localStream) return false;
        
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = !videoTrack.enabled;
            return videoTrack.enabled;
        }
        return false;
    }

    /**
     * Добавление слушателя событий
     */
    function on(event, callback) {
        if (!listeners.has(event)) {
            listeners.set(event, new Set());
        }
        listeners.get(event).add(callback);
    }

    /**
     * Удаление слушателя
     */
    function off(event, callback) {
        if (listeners.has(event)) {
            listeners.get(event).delete(callback);
        }
    }

    /**
     * Вызов событий
     */
    function emit(event, data) {
        if (listeners.has(event)) {
            listeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (e) {
                    console.error(`Ошибка в обработчике ${event}:`, e);
                }
            });
        }
    }

    // Публичное API
    return {
        isSupported,
        initVideoChat,
        endCall,
        startRecording,
        stopRecording,
        takeSnapshot,
        toggleMute,
        toggleVideo,
        on,
        off
    };
})();

window.VideoChat = VideoChat;