import React, { Component, Fragment } from 'react'
import { connect } from 'react-redux'
import { I18n } from 'react-redux-i18n'
import cx from 'classnames'

import iost from 'iostJS/iost'
import { Header } from 'components'
import Input from 'components/Input'
import Button from 'components/Button'
// import TokenBalance from 'components/TokenBalance'
import { GET_TOKEN_BALANCE_INTERVAL } from 'constants/token'
import TokenTransferSuccess from 'components/TokenTransferSuccess'
import TokenTransferFailed from 'components/TokenTransferFailed'
import ui from 'utils/ui'
import LoadingImage from 'components/LoadingImage'

import './index.scss'

const defaultConfig = {
  gasRatio: 1,
  gasLimit: 100000,
  delay: 0,
  expiration: 90,
  defaultLimit: "unlimited"
}

type Props = {

}

class Index extends Component<Props> {
  state = {
    to: '',
    amount: 0,
    memo: '',
    isSending: false,
    iGASPrice: defaultConfig.gasRatio,
    iGASLimit: defaultConfig.gasLimit,
    errorMessage: '',
    isShowing: false, // 是否显示多余资源输入框
  }

  componentDidMount() {
    this.intervalID = setInterval(() => {
      this.getTokenBalance()
      this.getResourceBalance()
    }, GET_TOKEN_BALANCE_INTERVAL)
  }

  getTokenBalance = async () => {
    const { selectedTokenSymbol } = this.props
    const { balance, frozen_balances } = await iost.rpc.blockchain.getBalance(iost.account.getID(), selectedTokenSymbol)

    let frozenAmount = 0

    if (frozen_balances && frozen_balances.length !== 0) {
      frozenAmount = frozen_balances.reduce((acc, cur) => (acc += cur.amount, acc), 0)
    }

    this.setState({
      balance: balance,
      frozenAmount,
      isLoading: false,
    })
  }

  getResourceBalance = async () => {
    const accountInfo = await iost.rpc.blockchain.getAccountInfo(iost.account.getID())
    this.setState({
      accountInfo,
      gas: accountInfo.gas_info && accountInfo.gas_info.current_total,
      ram: accountInfo.ram_info && accountInfo.ram_info.available,
      isLoading: false,
    })
  }

  handleChange = (e) => {
    this.setState({
      [e.target.name]: e.target.value,
      errorMessage: '',
    })
  }

  transfer = () => {
    const { to, amount, iGASPrice, iGASLimit, memo } = this.state
    const { selectedTokenSymbol } = this.props
    const accountName = iost.account.getID()

    // 1. Create transfer tx
    const tx = new iost.Tx(iGASPrice, iGASLimit, 0)
    if(iost.rpc.getProvider()._host.indexOf('//api.iost.io') < 0){
      tx.setChainID(1023)
    }
    tx.addAction(
      'token.iost',
      'transfer',
      JSON.stringify([selectedTokenSymbol, accountName, to, amount, memo]),
    )
    tx.setTime(defaultConfig.expiration, defaultConfig.delay)
    tx.addApprove("*", defaultConfig.defaultLimit)

    // const tx = iost.iost.transfer(selectedTokenSymbol, accountName, to, amount)

    // 2. Sign on transfer tx
    iost.account.signTx(tx)

    // iost.signAndSend(tx)
    //   .on('pending', (response) => {
    //     console.log(response)
    //   })
    //   .on('success', (response) => {
    //     console.log(response)
    //   })
    //   .on('failed', (response) => {
    //     console.log(response)
    //   })

    // 3. Handle transfer tx
    const handler = new iost.pack.TxHandler(tx, iost.rpc)

    this.setState({ isSending: true })
    let intervalID
    handler
      .onPending(async (res) => {
        intervalID = setInterval(async() => {
          const tx = await iost.rpc.transaction.getTxByHash(res.hash)
        }, 1000)
      })
      .onSuccess(async (response) => {
        clearInterval(intervalID)
        this.setState({ isSending: false })
        ui.settingTransferInfo(response)
        this.moveTo('/tokenTransferSuccess')()
        // ui.openPopup({
        //   content: <TokenTransferSuccess tx={response} />
        // })
      })
      .onFailed((err) => {
        clearInterval(intervalID)
        if (typeof err === 'string') {
          this.setState({
            isSending: false,
            errorMessage: typeof err === 'string' && err,
          })
        } else {
          this.setState({
            isSending: false,
          })
          ui.settingTransferInfo(err)
          this.moveTo('/tokenTransferFailed')()
          // ui.openPopup({
          //   content: <TokenTransferFailed tx={err} />
          // })
        }
      })
      .send()
      .listen(1000, 60)
  }

  moveTo = (location) => () => {
    const { changeLocation } = this.props
    changeLocation(location)
  }

  toggleMenu = () => {
    this.setState({
      isShowing: !this.state.isShowing,
    })
  }

  render() {
    const { isSending, iGASPrice, iGASLimit, errorMessage, isShowing, balance } = this.state
    const { className, selectedTokenSymbol } = this.props
    return (
      <Fragment>
        <Header title={I18n.t('Account_Transfer')} onBack={this.moveTo('/account')} hasSetting={false} />
        <div className="tokenTransfer-box">
          <div className="transferAmount-box">
            <span className="transferAmount">{I18n.t('Transfer_Amount')}</span>
            <span className="balance">{I18n.t('Transfer_Balance', { num: balance, token: selectedTokenSymbol })}</span>
          </div>
          <Input
            name="amount"
            onChange={this.handleChange}
            placeholder={I18n.t('Transfer_InputAmount')}
            className="input"
          />
          <label className="label">
            {I18n.t('Transfer_Payee')}
          </label>
          <Input
            name="to"
            onChange={this.handleChange}
            placeholder={I18n.t('Transfer_EnterName')}
            className="input"
          />
          <label className="label">
            {I18n.t('Transfer_Note')}
          </label>
          <Input
            name="memo"
            onChange={this.handleChange}
            placeholder={I18n.t('Transfer_Optional')}
            className="input"
          />

          <div className="transferAmount-box">
            <span className="transferAmount">{I18n.t('Transfer_Resource')}</span>
            <span className="iGAS-price" onClick={this.toggleMenu}>{iGASPrice} iGas <i /></span>
          </div>
          {
            isShowing && (
              <div>
                <Input
                  name="iGASPrice"
                  value={iGASPrice}
                  onChange={this.handleChange}
                  className="input"
                />
                <Input
                  name="iGASLimit"
                  value={iGASLimit}
                  onChange={this.handleChange}
                  className={cx('input', 'iGASLimit')}
                />
              </div>
            )
          }
          <div className="btn-box">
            <Button
              className="btn-submit"
              onClick={this.transfer}
            >
              {isSending ? <LoadingImage /> : I18n.t('Transfer_Submit')}
            </Button>
            <p className="transferTips">{I18n.t('Transfer_Tip')}</p>
          </div>
          <p className="TokenTransfer__errorMessage">{errorMessage}</p>
        </div>
      </Fragment>
    )
  }
}

const mapStateToProps = (state) => ({
  selectedTokenSymbol: state.token.selectedTokenSymbol,
})

export default connect(mapStateToProps)(Index)
