# Steps to enable the breakpoint service again:

This service has been disabled for now, as it is not used.
It is kept here until VSCode extends the breakpoints API.

1.  src/webview/memory-webview-view.tsx

```typescript
componentDidMount() {
 ...
 breakpointService.activate();
 breakpointService.onDidChange(() => this.forceUpdate());
}

doFetchMemory() {
 ...
 await Promise.all(Array.from(
  new Set(columnContributionService
      .getUpdateExecutors()
      .concat(decorationService.getUpdateExecutors())
      .concat(breakpointService)),
  executor => executor.fetchData(memoryOptions)
 ));
}
```

2.  src/webview/columns/address-column.tsx

Extend rendering (Should be done through a decorator)

```typescript
    render(columnIndex: number, row: MemoryRowData, config: ColumnRenderProps): ReactNode {
        const selectionProps: SelectionProps = {
            createSelection: (event, position) => createDefaultSelection(event, position, AddressColumn.ID, row),
            getSelection: () => config.selection,
            setSelection: config.setSelection
        };

        const breakpointMetadata = breakpointService.inRange(row)
            .map(bp => breakpointService.metadata(bp))
            .filter((bp): bp is BreakpointMetadata => bp !== undefined);
        const statusClasses = BreakpointService.statusClasses(breakpointMetadata);

        const groupProps = groupAttributes({ columnIndex, rowIndex: row.rowIndex, groupIndex: 0, maxGroupIndex: 0 }, selectionProps);
        return <span className='memory-start-address hoverable' data-column='address' {...groupProps}>
            {statusClasses.length > 0 && <span className={classNames('address-status', statusClasses)}></span>}
            {config.tableConfig.showRadixPrefix && <span className='radix-prefix'>{getRadixMarker(config.tableConfig.addressRadix)}</span>}
            <span className='address'>{getAddressString(row.startAddress, config.tableConfig.addressRadix, config.tableConfig.effectiveAddressLength)}</span>
        </span>;
    }
```

3.  src/webview/columns/data-column.tsx

Extend Context (Should be done through a contribution)

```typescript
    protected renderGroup(maus: React.ReactNode, startAddress: bigint, endAddress: bigint, idx: number): React.ReactNode {
        const { config, row, columnIndex } = this.props;
        const groupProps = groupAttributes({
            rowIndex: row.rowIndex,
            columnIndex: columnIndex,
            groupIndex: idx,
            maxGroupIndex: this.props.config.groupsPerRowToRender - 1
        }, this.selectionProps);
        const breakpointMetadata = breakpointService.metadata(toHexStringWithRadixMarker(startAddress));

        return <span
            tabIndex={0}
            className={classNames('byte-group', 'hoverable', ...BreakpointService.inlineClasses(breakpointMetadata))}
            data-column='data'
            {...groupProps}
            data-range-start={startAddress}
            data-range-end={endAddress}
            key={startAddress.toString(16)}
            onKeyDown={this.onKeyDown}
            onDoubleClick={this.setGroupEdit}
            {...createGroupVscodeContext(startAddress, toOffset(startAddress, endAddress, config.tableConfig.bytesPerMau * 8), breakpointMetadata)}
        >
            {maus}
        </span>;
    }
```

4. src/webview/utils/vscode-contexts.ts

```typescript
export function createGroupVscodeContext(
  startAddress: bigint,
  length: number,
  breakpoint?: BreakpointMetadata
): VscodeContext {
  return createVscodeContext({
    memoryData: { group: { startAddress, length } },
    breakpoint: { ...breakpoint, isBreakable: true },
  });
}

export function createVariableVscodeContext(
  variable: BigIntVariableRange,
  breakpoint?: BreakpointMetadata
): VscodeContext {
  const { name, type, value, parentVariablesReference, isPointer } = variable;
  return createVscodeContext({
    variable: { name, type, value, parentVariablesReference, isPointer },
    breakpoint: { ...breakpoint, isBreakable: true },
  });
}
```

5. src/webview/variables/variable-decorations.ts

Extend rendering (Should be done through a decorator)

```typescript
    render(columnIndex: number, row: MemoryRowData, config: ColumnRenderProps): ReactNode {
        const selectionProps: SelectionProps = {
            createSelection: (event, position) => createDefaultSelection(event, position, VariableDecorator.ID, row),
            getSelection: () => config.selection,
            setSelection: config.setSelection
        };
        const variables = this.getVariablesInRange(row);
        return variables?.reduce<ReactNode[]>((result, current, index) => {
            if (index > 0) { result.push(', '); }
            const breakpointMetadata = breakpointService.metadata(current.variable.name);
            result.push(React.createElement('span', {
                style: { color: current.color },
                key: current.variable.name,
                className: classNames('hoverable', ...BreakpointService.inlineClasses(breakpointMetadata)),
                'data-column': 'variables',
                'data-variables': stringifyWithBigInts(current.variable),
                ...createVariableVscodeContext(current.variable, breakpointMetadata),
                ...groupAttributes({ columnIndex, rowIndex: row.rowIndex, groupIndex: index, maxGroupIndex: variables.length - 1 }, selectionProps)
            }, current.variable.name));
            return result;
        }, []);
    }
```
