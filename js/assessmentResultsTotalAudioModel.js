define([
    'core/js/adapt',
    'core/js/models/componentModel'
], function(Adapt, ComponentModel) {

    var AssessmentResultsTotalAudioModel = ComponentModel.extend({

        init: function() {
            this.set('originalBody', this.get('body'));// save the original body text so we can restore it when the assessment is reset
            this.set('originalInstruction', this.get('instruction'));// save the original body text so we can restore it when the assessment is reset

            if (Adapt.audio && this.get('_audioAssessment')._isEnabled) {
              this.set('audioFile', this.get('_audioAssessment')._media.src);
            }

            this.listenTo(Adapt, {
                'assessment:complete': this.onAssessmentComplete,
                'assessments:reset': this.onAssessmentReset
            });
        },

        /**
         * Checks to see if the assessment was completed in a previous session or not
         */
        checkIfAssessmentComplete: function() {
            if (!Adapt.assessment || this.get('_assessmentId') === undefined) {
                return;
            }

            var assessmentModel = Adapt.assessment.get(this.get('_assessmentId'));
            if (!assessmentModel || assessmentModel.length === 0) return;

            var state = assessmentModel.getState();
            if (state.isComplete) {
                this.onAssessmentComplete(state);
                return;
            }

            this.setVisibility();
        },

        onAssessmentComplete: function(state) {
            /*
            make shortcuts to some of the key properties in the state object so that
            content developers can just use {{attemptsLeft}} in json instead of {{state.attemptsLeft}}
            */
            this.set( {
                _state: state,
                attempts: state.attempts,
                attemptsSpent: state.attemptsSpent,
                attemptsLeft: state.attemptsLeft,
                score: state.score,
                scoreAsPercent: state.scoreAsPercent,
                maxScore: state.maxScore,
                isPass: state.isPass
            });

            this.setFeedbackBand(state);

            this.setFeedbackText();

            this.toggleVisibility(true);
        },

        setFeedbackBand: function(state) {
            var scoreProp = state.isPercentageBased ? 'scoreAsPercent' : 'score';
            var bands = _.sortBy(this.get('_bands'), '_score');

            for (var i = (bands.length - 1); i >= 0; i--) {
                var isScoreInBandRange =  (state[scoreProp] >= bands[i]._score);
                if (!isScoreInBandRange) continue;

                this.set('_feedbackBand', bands[i]);
                break;
            }
        },

        setFeedbackText: function() {
            var feedbackBand = this.get('_feedbackBand');

            // ensure any handlebars expressions in the .feedback are handled...
            var feedback = feedbackBand ? Handlebars.compile(feedbackBand.feedback)(this.toJSON()) : '';

            this.set({
                feedback: feedback,
                body: this.get('_completionBody'),
                instruction: feedbackBand.instruction
            });

            if (Adapt.audio && this.get('_audioAssessment')._isEnabled) {
              this.set('audioFile', feedbackBand._audio.src);
            }
        },

        setVisibility: function() {
            if (!Adapt.assessment) return;

            var isVisibleBeforeCompletion = this.get('_isVisibleBeforeCompletion') || false;
            var wasVisible = this.get('_isVisible');

            var assessmentArticleModels = Adapt.assessment.get();
            if (assessmentArticleModels.length === 0) return;

            for (var i = 0, l = assessmentArticleModels.length; i < l; i++) {
                var articleModel = assessmentArticleModels[i];
                var assessmentState = articleModel.getState();
                var isComplete = assessmentState.isComplete;
                if (!isComplete) break;
            }

            if (!isComplete) {
                this.reset("hard", true);
            }

            var isVisible = isVisibleBeforeCompletion && !isComplete;

            if (!wasVisible && isVisible) isVisible = false;

            this.toggleVisibility(isVisible);
        },

        toggleVisibility: function (isVisible) {
            if (isVisible === undefined) {
                isVisible = !this.get('_isVisible');
            }

            this.set('_isVisible', isVisible, {pluginName: 'assessmentResultsTotalAudio'});
        },

        checkCompletion: function() {
            if (this.get('_setCompletionOn') === 'pass' && !this.get('isPass')) {
                return;
            }

            this.setCompletionStatus();
        },

        /**
         * Handles resetting the component whenever its corresponding assessment is reset
         * The component can either inherit the assessment's reset type or define its own
         */
        onAssessmentReset: function(state) {
            var resetType = this.get('_resetType');
            if (!resetType || resetType === 'inherit') {
                resetType = state.resetType || 'hard';// backwards compatibility - state.resetType was only added in assessment v2.3.0
            }
            this.reset(resetType, true);
        },

        reset: function() {
            this.set({
                body: this.get('originalBody'),
                instruction: this.get('originalInstruction'),
                state: null,
                feedback: '',
                _feedbackBand: null
            });

            ComponentModel.prototype.reset.apply(this, arguments);
        }
    });

    return AssessmentResultsTotalAudioModel;

});
