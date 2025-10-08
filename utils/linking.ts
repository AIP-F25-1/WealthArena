import { Linking, Alert } from 'react-native';

/**
 * Safely opens a URL with proper error handling
 * @param url The URL to open
 * @param fallbackMessage Optional fallback message if URL can't be opened
 */
export const openURL = async (url: string, fallbackMessage?: string): Promise<void> => {
  try {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      const message = fallbackMessage || `Can't open URL: ${url}`;
      console.warn(message);
      Alert.alert(
        'Link Error',
        'This link cannot be opened. Please check your internet connection or try again later.',
        [{ text: 'OK' }]
      );
    }
  } catch (error) {
    console.error('Error opening URL:', error);
    Alert.alert(
      'Link Error',
      'There was an error opening this link. Please try again later.',
      [{ text: 'OK' }]
    );
  }
};

/**
 * Opens external learning resource links safely
 * @param url The learning resource URL
 */
export const openLearningResource = (url: string): void => {
  openURL(url, `Unable to open learning resource: ${url}`);
};

/**
 * Opens Investopedia links safely with fallback
 * @param term The financial term to search for
 */
export const openInvestopediaLink = (term: string): void => {
  const url = `https://www.investopedia.com/terms/${term.charAt(0).toLowerCase()}/${term.toLowerCase()}.asp`;
  openURL(url, `Unable to open Investopedia link for ${term}`);
};

/**
 * Opens financial education links safely
 * @param url The education resource URL
 */
export const openEducationLink = (url: string): void => {
  openURL(url, `Unable to open education resource: ${url}`);
};
