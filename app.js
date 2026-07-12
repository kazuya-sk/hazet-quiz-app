/**
 * HAZET Quiz App Logic Controller
 * Manages states, dynamic DOM generation, score calculation, review list, and X sharing.
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- Application State ---
    let currentLevel = null;
    let selectedQuestions = [];
    let currentIndex = 0;
    let score = 0;
    let userAnswers = [];

    // --- DOM Elements Caching ---
    const startScreen = document.getElementById('start-screen');
    const playScreen = document.getElementById('play-screen');
    const resultScreen = document.getElementById('result-screen');

    const courseCards = document.querySelectorAll('.course-card');
    const startQuizBtn = document.getElementById('start-quiz-btn');

    // Play Screen elements
    const questionNumber = document.getElementById('question-number');
    const courseBadge = document.getElementById('course-badge');
    const progressBar = document.getElementById('quiz-progress-bar');
    const questionText = document.getElementById('question-text');
    const choicesContainer = document.getElementById('choices-container');
    
    // Feedback Panel elements
    const feedbackPanel = document.getElementById('feedback-panel');
    const feedbackTitle = document.getElementById('feedback-title');
    const feedbackIconContainer = document.getElementById('feedback-icon-container');
    const correctAnswerAlert = document.getElementById('correct-answer-alert');
    const correctAnswerText = document.getElementById('correct-answer-text');
    const explanationText = document.getElementById('explanation-text');
    const nextQuestionBtn = document.getElementById('next-question-btn');

    // Result Screen elements
    const resultScoreTitle = document.getElementById('result-score-title');
    const resultEvaluation = document.getElementById('result-evaluation');
    const reviewList = document.getElementById('review-list');
    const shareXBtn = document.getElementById('share-x-btn');
    const retryBtn = document.getElementById('retry-btn');

    // Choice Labels (A, B, C, D)
    const CHOICE_LABELS = ['A', 'B', 'C', 'D'];

    // --- Course Metadata for Display ---
    const LEVEL_NAMES = {
        beginner: '初級',
        intermediate: '中級',
        advanced: '上級'
    };

    // --- 1. Initialization ---
    function init() {
        // Setup course selection cards
        courseCards.forEach(card => {
            card.addEventListener('click', () => {
                // Remove selection from others
                courseCards.forEach(c => c.classList.remove('selected'));
                
                // Set current selection
                card.classList.add('selected');
                currentLevel = card.getAttribute('data-level');
                
                // Enable the start button
                startQuizBtn.classList.remove('disabled');
                startQuizBtn.removeAttribute('disabled');
                
                // Micro-vibration / Feedback
                if (navigator.vibrate) {
                    navigator.vibrate(10);
                }
            });
        });

        // Start Quiz Button
        startQuizBtn.addEventListener('click', startQuiz);

        // Next Question Button
        nextQuestionBtn.addEventListener('click', handleNextQuestion);

        // Retry Button
        retryBtn.addEventListener('click', resetQuiz);

        // X (Twitter) Share Button
        shareXBtn.addEventListener('click', shareOnX);
    }

    // --- 2. Quiz Flow Management ---

    // Shuffle Utility (Fisher-Yates)
    function shuffleArray(array) {
        const copy = [...array];
        for (let i = copy.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
    }

    function startQuiz() {
        if (!currentLevel) return;

        // Reset state
        score = 0;
        currentIndex = 0;
        userAnswers = [];
        selectedQuestions = [];

        // Check if database is loaded
        if (!window.HAZET_QUESTIONS || !window.HAZET_QUESTIONS[currentLevel]) {
            alert('問題データが見つかりません。リロードしてください。');
            return;
        }

        // Get and shuffle questions pool, pick 5
        const pool = window.HAZET_QUESTIONS[currentLevel];
        const shuffled = shuffleArray(pool);
        selectedQuestions = shuffled.slice(0, 5);

        // Update UI Header details
        courseBadge.textContent = LEVEL_NAMES[currentLevel];
        
        // Remove old difficulty styling classes from badge
        courseBadge.className = 'level-indicator';
        if (currentLevel === 'beginner') {
            courseBadge.style.borderColor = '#10b981';
            courseBadge.style.color = '#10b981';
        } else if (currentLevel === 'intermediate') {
            courseBadge.style.borderColor = 'var(--hazet-cyan)';
            courseBadge.style.color = 'var(--hazet-cyan)';
        } else if (currentLevel === 'advanced') {
            courseBadge.style.borderColor = 'var(--hazet-yellow)';
            courseBadge.style.color = 'var(--hazet-yellow)';
        }

        // Switch Screen
        switchScreen(startScreen, playScreen);

        // Load first question
        loadQuestion();
    }

    function loadQuestion() {
        // Hide feedback panel
        feedbackPanel.classList.add('hidden');

        // Get current question details
        const q = selectedQuestions[currentIndex];
        
        // Update headers & progress indicators
        questionNumber.textContent = `第 ${currentIndex + 1} / 5 問`;
        const percentage = ((currentIndex) / 5) * 100;
        progressBar.style.width = `${percentage}%`;

        // Render question text
        questionText.textContent = q.q;

        // Create options with original indices to track correctness
        const optionsWithIndices = q.o.map((option, index) => ({
            text: option,
            originalIndex: index
        }));

        // Shuffle the options
        const shuffledOptions = shuffleArray(optionsWithIndices);

        // Clear choices container and render new ones
        choicesContainer.innerHTML = '';
        shuffledOptions.forEach((opt, index) => {
            const button = document.createElement('button');
            button.className = 'choice-btn';
            button.setAttribute('data-original-index', opt.originalIndex);
            
            button.innerHTML = `
                <span class="choice-label">${CHOICE_LABELS[index]}</span>
                <span class="choice-text">${opt.text}</span>
            `;
            
            button.addEventListener('click', handleChoiceClick);
            choicesContainer.appendChild(button);
        });
    }

    function handleChoiceClick(e) {
        const selectedBtn = e.currentTarget;
        const selectedOriginalIndex = parseInt(selectedBtn.getAttribute('data-original-index'));
        const q = selectedQuestions[currentIndex];
        const correctOriginalIndex = q.a;
        const isCorrect = (selectedOriginalIndex === correctOriginalIndex);

        // Disable all buttons to freeze responses
        const choiceBtns = choicesContainer.querySelectorAll('.choice-btn');
        choiceBtns.forEach(btn => {
            btn.setAttribute('disabled', 'true');
            const btnOriginalIdx = parseInt(btn.getAttribute('data-original-index'));
            
            // Highlight the correct answer in green
            if (btnOriginalIdx === correctOriginalIndex) {
                btn.classList.add('correct');
            }
            // Highlight the user's wrong answer in red
            if (btnOriginalIdx === selectedOriginalIndex && !isCorrect) {
                btn.classList.add('incorrect');
            }
        });

        // Save progress details
        userAnswers.push({
            question: q.q,
            options: q.o,
            selected: selectedOriginalIndex,
            correct: correctOriginalIndex,
            isCorrect: isCorrect,
            explanation: q.ex
        });

        // Set Feedback Header Styling
        feedbackTitle.className = ''; // reset classes
        feedbackIconContainer.className = 'feedback-icon'; // reset classes

        if (isCorrect) {
            score++;
            feedbackTitle.textContent = '正解！';
            feedbackTitle.classList.add('feedback-title-correct');
            feedbackIconContainer.classList.add('correct');
            feedbackIconContainer.innerHTML = '<i class="fa-solid fa-circle-check"></i>';
            correctAnswerAlert.classList.add('hidden');
        } else {
            feedbackTitle.textContent = '不正解...';
            feedbackTitle.classList.add('feedback-title-incorrect');
            feedbackIconContainer.classList.add('incorrect');
            feedbackIconContainer.innerHTML = '<i class="fa-solid fa-circle-xmark"></i>';
            
            // Show correct answer alert
            correctAnswerText.textContent = q.o[correctOriginalIndex];
            correctAnswerAlert.classList.remove('hidden');
        }

        // Render explanation
        explanationText.textContent = q.ex;

        // Show explanation panel
        feedbackPanel.classList.remove('hidden');

        // Scroll page smoothly to show explanation on smaller screens
        setTimeout(() => {
            feedbackPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
    }

    function handleNextQuestion() {
        currentIndex++;
        
        // Progress bar visual update to 100% on the last question completion
        if (currentIndex === 5) {
            progressBar.style.width = '100%';
        }

        if (currentIndex < 5) {
            loadQuestion();
        } else {
            showResults();
        }
    }

    // --- 3. Results Management ---
    function showResults() {
        // Set evaluation message and display
        resultScoreTitle.textContent = `5問中 ${score}問 正解！`;

        let evalMessage = '';
        if (score === 5) {
            evalMessage = 'ハゼットマスター！完璧な知識をお持ちですね。あなたは一流のプロ整備士レベルです！';
        } else if (score === 4) {
            evalMessage = 'ハゼットマニア級！素晴らしいハゼット愛と知識です。あと一歩で完璧でした！';
        } else if (score >= 2) {
            evalMessage = 'ハゼット愛好家レベル。日常の工具についての知識が備わっています。もっと極めましょう！';
        } else {
            evalMessage = 'ハゼット見習い。まずはハゼットの素晴らしい工具の歴史やカタログを見て学んでみましょう！';
        }
        resultEvaluation.textContent = evalMessage;

        // Render review panel
        reviewList.innerHTML = '';
        userAnswers.forEach((ans, index) => {
            const item = document.createElement('div');
            item.className = `review-item ${ans.isCorrect ? 'correct' : 'incorrect'}`;
            
            item.innerHTML = `
                <div class="review-question-header">
                    <h4 class="review-question-title">Q${index + 1}. ${ans.question}</h4>
                    <span class="review-status-badge">${ans.isCorrect ? '正解' : '不正解'}</span>
                </div>
                
                <div class="review-answers">
                    <p class="review-user-answer">あなたの回答: <span>${ans.options[ans.selected]}</span></p>
                    ${!ans.isCorrect ? `<p class="review-correct-answer">正しい正解: <span>${ans.options[ans.correct]}</span></p>` : ''}
                </div>
                
                <p class="review-explanation">
                    <strong>解説:</strong> ${ans.explanation}
                </p>
            `;
            reviewList.appendChild(item);
        });

        // Switch Screen
        switchScreen(playScreen, resultScreen);
    }

    function shareOnX() {
        const levelName = LEVEL_NAMES[currentLevel];
        const text = `【HAZET公式HP参考クイズ】\n${levelName}コースに挑戦して、5問中 ${score}問 正解しました！\nドイツの名門工具ブランド「ハゼット」の知識を試してみませんか？\n#HAZET #ハゼット #ハゼットクイズ\n`;
        const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(location.origin + location.pathname)}`;
        
        window.open(shareUrl, '_blank');
    }

    function resetQuiz() {
        // Go back to Level Selection Screen
        currentLevel = null;
        
        // Remove selections from course selection cards
        courseCards.forEach(c => c.classList.remove('selected'));
        
        // Disable Start Button
        startQuizBtn.classList.add('disabled');
        startQuizBtn.setAttribute('disabled', 'true');

        // Switch Screen
        switchScreen(resultScreen, startScreen);
    }

    // --- 4. Navigation Utility ---
    function switchScreen(fromScreen, toScreen) {
        // Smoothly fade out active screen
        fromScreen.style.opacity = '0';
        fromScreen.style.transform = 'translateY(-15px)';
        
        setTimeout(() => {
            fromScreen.classList.remove('active');
            
            // Fade in target screen
            toScreen.classList.add('active');
            // Force reflow
            toScreen.offsetHeight;
            
            toScreen.style.opacity = '1';
            toScreen.style.transform = 'translateY(0)';
            
            // Scroll back to top on screen transitions
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }, 300);
    }

    // Run setup
    init();
});
