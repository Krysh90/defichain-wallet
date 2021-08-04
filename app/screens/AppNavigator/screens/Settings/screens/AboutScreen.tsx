import { nativeApplicationVersion } from 'expo-application'
import React, { useCallback } from 'react'
import { Linking, ScrollView, TouchableOpacity, View } from 'react-native'
import { Text } from '../../../../../components'
import { AppIcon } from '../../../../../components/icons/AppIcon'
import { SectionTitle } from '../../../../../components/SectionTitle'
import { tailwind } from '../../../../../tailwind'
import { translate } from '../../../../../translations'

interface AboutScreenLinks {
  testID: string
  title: string
  url: string
}

const ABOUT_LINKS: AboutScreenLinks[] = [
  { testID: 'white_paper', title: 'White Paper', url: 'https://defichain.com/white-paper/' },
  { testID: 'privacy_policy_button', title: 'Privacy Policy', url: 'https://defichain.com/privacy-policy/' },
  {
    testID: 'licenses_button',
    title: 'Licenses',
    url: 'https://app.fossa.com/projects/git%2Bgithub.com%2FDeFiCh%2Fwallet/refs/branch/main/eefb43ca2933838df8d16ad8c3b2b92db3278843/browse/licenses'
  }
]

export function AboutScreen (): JSX.Element {
  return (
    <ScrollView style={tailwind('bg-gray-100')}>
      <View style={tailwind('flex-1 items-center justify-center p-8')}>
        <AppIcon testID='app_logo' width={100} height={100} />
        <Text style={tailwind('text-2xl font-bold mt-3')}>
          {translate('screens/AboutScreen', 'DeFiChain Wallet')}
        </Text>
        <Text style={tailwind('text-base font-light text-black')}>
          {`v${nativeApplicationVersion ?? '0.0.0'}`}
        </Text>
      </View>
      <SectionTitle text={translate('screens/AboutScreen', 'LINKS')} testID='links_title' />
      {
        ABOUT_LINKS.map((link) => <LinkItemRow {...link} key={link.testID} />)
      }
    </ScrollView>
  )
}

function LinkItemRow ({ title, url, testID }: AboutScreenLinks): JSX.Element {
  const handlePress = useCallback(async () => {
    const supported = await Linking.canOpenURL(url)
    if (supported) {
      await Linking.openURL(url)
    }
  }, [url])

  return (
    <TouchableOpacity
      style={tailwind('flex-row bg-white p-4 items-center border-b border-gray-200')}
      onPress={handlePress}
      testID={testID}
    >
      <Text style={tailwind('font-semibold text-primary')}>
        {translate('screens/AboutScreen', title)}
      </Text>
    </TouchableOpacity>
  )
}