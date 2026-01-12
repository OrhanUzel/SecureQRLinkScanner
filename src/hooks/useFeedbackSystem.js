import { useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const FEEDBACK_COUNT_KEY = 'feedback_link_open_count';
const FEEDBACK_GIVEN_KEY = 'feedback_given';

export function useFeedbackSystem() {
  const [feedbackVisible, setFeedbackVisible] = useState(false);

  const registerLinkOpen = async () => {
    try {
      const hasGivenFeedback = await AsyncStorage.getItem(FEEDBACK_GIVEN_KEY);
      if (hasGivenFeedback === 'true') return;

      const currentCountStr = await AsyncStorage.getItem(FEEDBACK_COUNT_KEY);
      const currentCount = parseInt(currentCountStr || '0', 10);
      const newCount = currentCount + 1;
      
      await AsyncStorage.setItem(FEEDBACK_COUNT_KEY, newCount.toString());

      if (newCount === 3) {
        setFeedbackVisible(true);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error in feedback system:', error);
      return false;
    }
  };

  const closeFeedback = () => {
    setFeedbackVisible(false);
  };
  
  const markFeedbackGiven = async () => {
     try {
       await AsyncStorage.setItem(FEEDBACK_GIVEN_KEY, 'true');
     } catch (e) {
       console.error(e);
     }
  };

  return {
    feedbackVisible,
    closeFeedback,
    registerLinkOpen,
    markFeedbackGiven
  };
}
