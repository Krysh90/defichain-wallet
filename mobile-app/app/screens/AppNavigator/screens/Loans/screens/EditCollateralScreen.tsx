import { View } from '@components'
import { SymbolIcon } from '@components/SymbolIcon'
import {
  ThemedIcon,
  ThemedScrollView,
  ThemedSectionTitle,
  ThemedText,
  ThemedView
} from '@components/themed'
import { StackScreenProps } from '@react-navigation/stack'
import { tailwind } from '@tailwind'
import { translate } from '@translations'
import BigNumber from 'bignumber.js'
import { BottomSheetModal } from '@gorhom/bottom-sheet'
import React, { Dispatch, useCallback, useEffect, useRef, useState } from 'react'
import { TouchableOpacity } from 'react-native'
import NumberFormat from 'react-number-format'
import { LoanParamList } from '../LoansNavigator'
import { BottomSheetNavScreen, BottomSheetWithNav } from '@components/BottomSheetWithNav'
import {
  AddOrEditCollateralForm,
  AddOrEditCollateralResponse
} from '../components/AddOrEditCollateralForm'
import { BottomSheetTokenList } from '@components/BottomSheetTokenList'
import { useThemeContext } from '@shared-contexts/ThemeProvider'
import { WalletAlert } from '@components/WalletAlert'
import { useWhaleApiClient } from '@shared-contexts/WhaleContext'
import { NativeLoggingProps, useLogger } from '@shared-contexts/NativeLoggingProvider'
import { useDispatch, useSelector } from 'react-redux'
import { useWalletContext } from '@shared-contexts/WalletContext'
import { RootState } from '@store'
import { fetchCollateralTokens, fetchVaults } from '@store/loans'
import { CollateralToken, LoanVaultActive, LoanVaultTokenAmount } from '@defichain/whale-api-client/dist/api/loan'
import { createSelector } from '@reduxjs/toolkit'
import { useTokensAPI } from '@hooks/wallet/TokensAPI'
import { WhaleWalletAccount } from '@defichain/whale-api-wallet'
import { CTransactionSegWit, TransactionSegWit } from '@defichain/jellyfish-transaction'
import { transactionQueue } from '@store/transaction_queue'
import { NumberRow, NumberRowRightElement } from '@components/NumberRow'
import { IconButton } from '@components/IconButton'
import { TokenData } from '@defichain/whale-api-client/dist/api/tokens'
import { useVaultShare } from '@screens/AppNavigator/screens/Loans/hooks/VaultShare'

type Props = StackScreenProps<LoanParamList, 'EditCollateralScreen'>

export interface Collateral {
  collateralId: string
  collateralFactor: BigNumber
  amount: BigNumber
  amountValue: BigNumber
  vaultProportion: BigNumber
  available: BigNumber
}

export interface CollateralItem extends CollateralToken {
  available: BigNumber
}

export function EditCollateralScreen ({
  route
}: Props): JSX.Element {
  const { address } = useWalletContext()
  const { vaultId } = route.params
  const client = useWhaleApiClient()
  const logger = useLogger()
  const { isLight } = useThemeContext()
  const [bottomSheetScreen, setBottomSheetScreen] = useState<BottomSheetNavScreen[]>([])
  const [activeVault, setActiveVault] = useState<LoanVaultActive>()
  const dispatch = useDispatch()

  const tokens = useTokensAPI()
  const getTokenAmount = (tokenId: string): BigNumber => {
    return new BigNumber(tokens.find((t) => t.id === tokenId)?.amount ?? 0)
  }

  const {
    vaults
  } = useSelector((state: RootState) => state.loans)
  const collateralSelector = createSelector((state: RootState) => state.loans.collateralTokens, (collaterals) => collaterals.map((c) => {
    return {
      ...c,
      available: getTokenAmount(c.token.id)
    }
  }).sort((a, b) => b.available.minus(a.available).toNumber()))
  const collateralTokens: CollateralItem[] = useSelector((state: RootState) => collateralSelector(state))
  useEffect(() => {
    dispatch(fetchCollateralTokens({ client }))
  }, [])

  useEffect(() => {
    const v = vaults.find((v) => v.vaultId === vaultId) as LoanVaultActive
    if (v !== undefined) {
      setActiveVault({ ...v })
    }
  }, [vaults])

  const bottomSheetRef = useRef<BottomSheetModal>(null)
  const expandModal = useCallback(() => {
    bottomSheetRef.current?.present()
  }, [])
  const dismissModal = useCallback(() => {
    bottomSheetRef.current?.close()
  }, [])

  const onAddCollateral = async (item: AddOrEditCollateralResponse): Promise<void> => {
    dismissModal()
    await addCollateral({
      vaultId,
      tokenAmount: item.amount,
      token: item.token
    }, dispatch, logger, () => {
      dispatch(fetchVaults({
        address,
        client
      }))
    })
  }

  return (
    <View style={tailwind('flex-1')}>
      <ThemedScrollView
        contentContainerStyle={tailwind('p-4 pt-0')}
      >
        <SectionTitle title='VAULT DETAILS' />
        {(activeVault != null) && <VaultIdSection vault={activeVault} />}
        <AddCollateralButton
          disabled={false}
          onPress={() => {
            setBottomSheetScreen([
              {
                stackScreenName: 'TokenList',
                component: BottomSheetTokenList({
                  collateralTokens,
                  headerLabel: translate('screens/EditCollateralScreen', 'Select token to add'),
                  onCloseButtonPress: () => bottomSheetRef.current?.close(),
                  navigateToScreen: {
                    screenName: 'AddOrEditCollateralForm',
                    onButtonPress: onAddCollateral
                  }
                }),
                option: {
                  header: () => null,
                  headerBackTitleVisible: false
                }
              },
              {
                stackScreenName: 'AddOrEditCollateralForm',
                component: AddOrEditCollateralForm,
                option: {
                  headerStatusBarHeight: 1,
                  headerBackgroundContainerStyle: tailwind('-top-5 border-b', {
                    'border-gray-200': isLight,
                    'border-gray-700': !isLight
                  }),
                  headerTitle: '',
                  headerBackTitleVisible: false
                }
              }
            ])
            expandModal()
          }}
        />
        <SectionTitle title='COLLATERALS' />
        {activeVault?.collateralAmounts.map(collateral => {
          const collateralItem = collateralTokens.find((col) => col.token.id === collateral.id)
          return (
            <CollateralCard
              key={collateral.id}
              collateralItem={collateralItem}
              totalCollateralValue={activeVault?.collateralValue}
              collateral={collateral}
              onAddPress={() => {
                if (collateralItem !== undefined) {
                  setBottomSheetScreen([
                    {
                      stackScreenName: 'AddOrEditCollateralForm',
                      component: AddOrEditCollateralForm,
                      initialParam: {
                        token: collateralItem.token,
                        available: collateralItem.available.toFixed(8),
                        onButtonPress: onAddCollateral,
                        onCloseButtonPress: () => bottomSheetRef.current?.close(),
                        collateralFactor: new BigNumber(collateralItem.factor ?? 0).times(100)
                      },
                      option: {
                        header: () => null
                      }
                    }
                  ])
                  expandModal()
                }
              }}
              onRemovePress={() => {
                WalletAlert({
                  title: translate('screens/EditCollateralScreen', 'Are you sure you want to remove collateral token?'),
                  buttons: [
                    {
                      text: translate('screens/EditCollateralScreen', 'Cancel'),
                      style: 'cancel'
                    },
                    {
                      text: translate('screens/EditCollateralScreen', 'Remove'),
                      style: 'destructive',
                      onPress: () => {
                        // TODO: handle on remove collateral
                      }
                    }
                  ]
                })
              }}
            />
          )
        })}
      </ThemedScrollView>
      <BottomSheetWithNav
        modalRef={bottomSheetRef}
        screenList={bottomSheetScreen}
      />
      {/* TODO: handle bottom sheet in desktop */}
    </View>
  )
}

function SectionTitle (props: { title: string }): JSX.Element {
  return (
    <ThemedSectionTitle
      style={tailwind('text-xs pb-2 pt-4 font-medium')}
      text={translate('screens/EditCollateralScreen', props.title)}
    />
  )
}

function VaultIdSection (props: { vault: LoanVaultActive }): JSX.Element {
  const { vault } = props
  return (
    <ThemedView
      light={tailwind('bg-white border-gray-200')}
      dark={tailwind('bg-gray-800 border-gray-700')}
      style={tailwind('flex flex-col items-center border rounded px-4 py-3')}
    >
      <View
        style={tailwind('flex flex-1 mb-2')}
      >
        <ThemedText
          style={tailwind('font-medium')}
          numberOfLines={1}
          ellipsizeMode='middle'
        >
          {vault.vaultId}
        </ThemedText>
      </View>
      <VaultSectionTextRow
        testID='text_total_collateral_value'
        value={new BigNumber(vault.collateralValue ?? 0).toFixed(2)} prefix='$'
        lhs={translate('components/EditCollateralScreen', 'Total collateral (USD)')}
      />
      <VaultSectionTextRow
        testID='text_total_collateral_value' value={new BigNumber(vault.loanValue ?? 0).toFixed(2)}
        prefix='$'
        lhs={translate('components/EditCollateralScreen', 'Total loan (USD)')}
      />
      <VaultSectionTextRow
        testID='text_total_collateral_value'
        value={BigNumber.maximum(new BigNumber(vault.collateralRatio ?? 0), 0).toFixed(2)}
        suffix='%'
        suffixType='text'
        lhs={translate('components/EditCollateralScreen', 'Collateralization ratio')}
      />
      <VaultSectionTextRow
        testID='text_total_collateral_value'
        value={new BigNumber(vault.loanScheme.minColRatio ?? 0).toFixed(2)} suffix='%'
        suffixType='text'
        lhs={translate('components/EditCollateralScreen', 'Min. collateralization ratio')}
      />
      <VaultSectionTextRow
        testID='text_vault_interest_value'
        value={new BigNumber(vault.loanScheme.interestRate ?? 0).toFixed(2)} suffix='%'
        suffixType='text'
        lhs={translate('components/EditCollateralScreen', 'Vault interest')}
      />
    </ThemedView>
  )
}

interface VaultSectionText extends NumberRowRightElement {
  lhs: string
}

function VaultSectionTextRow (props: VaultSectionText): JSX.Element {
  return (
    <NumberRow
      lhs={props.lhs}
      rhs={{
        value: props.value,
        testID: props.testID,
        suffix: props.suffix,
        suffixType: props.suffixType,
        prefix: props.prefix
      }}
      style={tailwind('flex-row items-center w-full my-1')}
      dark={tailwind('bg-gray-800')}
      light={tailwind('bg-white')}
      textStyle={tailwind('text-xs')}
    />
  )
}

interface CollateralCardProps {
  collateral: LoanVaultTokenAmount
  onAddPress: () => void
  onRemovePress: () => void
  collateralItem?: CollateralItem
  totalCollateralValue?: string
}

function CollateralCard (props: CollateralCardProps): JSX.Element {
  const {
    collateral,
    collateralItem,
    totalCollateralValue
  } = props
  const activePrice = collateral.activePrice?.active?.amount ?? 0
  const collateralPrice = new BigNumber(activePrice).multipliedBy(collateral.amount)
  const vaultShare = useVaultShare(new BigNumber(collateral.amount ?? 0), new BigNumber(collateralItem?.factor ?? 0), new BigNumber(activePrice), new BigNumber(totalCollateralValue ?? 0))
  return (
    <ThemedView
      light={tailwind('bg-white border-gray-200')}
      dark={tailwind('bg-gray-800 border-gray-700')}
      style={tailwind('border rounded p-4 mb-2')}
    >
      <ThemedView
        light={tailwind('bg-white border-gray-200')}
        dark={tailwind('bg-gray-800 border-gray-700')}
        style={tailwind('flex flex-row items-center justify-between border-b pb-4 mb-2')}
      >
        <View style={tailwind('flex flex-row items-center')}>
          <SymbolIcon
            symbol={collateral.displaySymbol} styleProps={{
            width: 24,
            height: 24
          }}
          />
          <ThemedText
            style={tailwind('font-medium ml-1 mr-2')}
          >
            {collateral.displaySymbol}
          </ThemedText>
          <ThemedView
            light={tailwind('text-gray-700 border-gray-700')}
            dark={tailwind('text-gray-300 border-gray-300')}
            style={tailwind('border rounded')}
          >
            <NumberFormat
              value={new BigNumber(collateralItem?.factor ?? 0).multipliedBy(100).toFixed(8)}
              decimalScale={2}
              displayType='text'
              suffix='%'
              renderText={value =>
                <ThemedText
                  light={tailwind('text-gray-700')}
                  dark={tailwind('text-gray-300')}
                  style={tailwind('text-xs font-medium px-1')}
                >
                  {value}
                </ThemedText>}
            />
          </ThemedView>
        </View>
        <View style={tailwind('flex flex-row')}>
          <IconButton
            iconType='MaterialIcons'
            iconName='add'
            iconSize={20}
            onPress={() => props.onAddPress()}
          />
          {/* <IconButton
            iconType='MaterialIcons'
            iconName='remove'
            iconSize={20}
            style={tailwind('ml-2')}
            onPress={() => props.onRemovePress()}
          /> */}
        </View>
      </ThemedView>
      <View style={tailwind('flex flex-row justify-between')}>
        <View style={tailwind('w-8/12')}>
          <CardLabel text='Collateral amount (USD)' />
          <View style={tailwind('mt-0.5')}>
            <NumberFormat
              value={collateral.amount}
              thousandSeparator
              decimalScale={8}
              displayType='text'
              suffix={` ${collateral.displaySymbol}`}
              renderText={(val: string) => (
                <ThemedText
                  dark={tailwind('text-gray-50')}
                  light={tailwind('text-gray-900')}
                  style={tailwind('text-sm font-medium')}
                >
                  {val}
                  {
                    !new BigNumber(activePrice).isZero() &&
                      <NumberFormat
                        value={collateralPrice.toFixed(2)}
                        thousandSeparator
                        decimalScale={2}
                        displayType='text'
                        prefix='$'
                        renderText={(val: string) => (
                          <ThemedText
                            dark={tailwind('text-gray-400')}
                            light={tailwind('text-gray-500')}
                            style={tailwind('text-xs')}
                          >
                            {` /${val}`}
                          </ThemedText>
                      )}
                      />
                  }
                </ThemedText>
              )}
            />

          </View>
        </View>
        <View style={tailwind('w-4/12 flex items-end')}>
          <CardLabel text='Vault %' />
          <NumberFormat
            value={vaultShare.toFixed(2)}
            thousandSeparator
            decimalScale={2}
            displayType='text'
            suffix=' %'
            renderText={(val: string) => (
              <ThemedView
                light={tailwind('bg-gray-100')}
                dark={tailwind('bg-gray-900')}
                style={tailwind('px-2 py-0.5 rounded')}
              >
                <ThemedText
                  light={tailwind('text-gray-900')}
                  dark={tailwind('text-gray-50')}
                  style={tailwind('text-sm font-medium')}
                >
                  {val}
                </ThemedText>
              </ThemedView>
            )}
          />
        </View>
      </View>
    </ThemedView>
  )
}

function CardLabel (props: { text: string }): JSX.Element {
  return (
    <ThemedText
      light={tailwind('text-gray-500')}
      dark={tailwind('text-gray-400')}
      style={tailwind('text-xs mb-1')}
    >
      {translate('screens/EditCollateralScreen', props.text)}
    </ThemedText>
  )
}

function AddCollateralButton (props: { disabled: boolean, onPress: () => void }): JSX.Element {
  return (
    <TouchableOpacity
      disabled={props.disabled}
      style={tailwind('my-6 flex flex-row justify-center')}
      onPress={props.onPress}
    >
      <ThemedIcon
        iconType='MaterialIcons'
        name='add'
        size={14}
        light={tailwind({
          'text-primary-500': !props.disabled,
          'text-gray-300': props.disabled
        })}
        dark={tailwind({
          'text-darkprimary-500': !props.disabled,
          'text-gray-600': props.disabled
        })}
      />
      <ThemedText
        light={tailwind({
          'text-primary-500': !props.disabled,
          'text-gray-300': props.disabled
        })}
        dark={tailwind({
          'text-darkprimary-500': !props.disabled,
          'text-gray-600': props.disabled
        })}
        style={tailwind('pl-2.5 text-sm font-medium leading-4 mb-2')}
      >
        {translate('screens/EditCollateralScreen', 'ADD TOKEN AS COLLATERAL')}
      </ThemedText>
    </TouchableOpacity>
  )
}

interface AddCollateralForm {
  vaultId: string
  tokenAmount: BigNumber
  token: TokenData
}

async function addCollateral ({
  vaultId,
  tokenAmount,
  token
}: AddCollateralForm, dispatch: Dispatch<any>, logger: NativeLoggingProps, onConfirmation: () => void): Promise<void> {
  try {
    const signer = async (account: WhaleWalletAccount): Promise<CTransactionSegWit> => {
      const script = await account.getScript()
      const builder = account.withTransactionBuilder()

      const signed: TransactionSegWit = await builder.loans.depositToVault({
        vaultId,
        from: script,
        tokenAmount: {
          token: +token.id,
          amount: tokenAmount
        }
      }, script)
      return new CTransactionSegWit(signed)
    }

    dispatch(transactionQueue.actions.push({
      sign: signer,
      title: translate('screens/EditCollateralScreen', 'Adding collateral'),
      description: translate('screens/EditCollateralScreen', 'Adding {{amount}} {{symbol}} as collateral', {
        amount: tokenAmount.toFixed(8),
        symbol: token.displaySymbol
      }),
      onConfirmation
    }))
  } catch (e) {
    logger.error(e)
  }
}