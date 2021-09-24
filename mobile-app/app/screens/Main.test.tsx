import { render } from '@testing-library/react-native'
import * as React from 'react'
import { Main } from './Main'

jest.mock('../contexts/ThemeProvider')

describe('<Main>', () => {
  it('should match snapshot', async () => {
    const component = (
      <Main />
    )
    const rendered = render(component)
    expect(rendered.toJSON()).toMatchSnapshot()
  })
})